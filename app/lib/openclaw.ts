import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { prisma } from "./db";
import {
  APPROVAL_ACK_RE,
  APPROVE_COMMAND_RE,
  containsApprovalPrompt,
} from "./approval";

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");
const OPENCLAW_SESSIONS_PATH = path.join(
  os.homedir(),
  ".openclaw",
  "agents",
  "main",
  "sessions",
  "sessions.json",
);
const REPLY_TO_CURRENT_RE = /^\[\[reply_to_current\]\]\s*/;

type GatewayConfig = {
  port: number;
  token: string;
};

type SessionStoreEntry = {
  sessionFile?: string;
};

type TranscriptTurn = {
  role: "user" | "assistant";
  content: string;
};

type SessionTranscriptEntry = {
  type?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type?: string; text?: string }>;
  };
};

const CONTEXT_WRAPPER_RE = /^\[Chat messages since your last reply - for context\]/i;
const CURRENT_MESSAGE_WRAPPER_RE = /^\[Current message - respond to this\]/i;
const ASYNC_COMPLETION_WRAPPER_RE =
  /^\[[A-Z][a-z]{2}\s+\d{4}-\d{2}-\d{2}.*\]\s+An async command/i;

function normalizeVisibleText(content: string): string {
  return content.replace(REPLY_TO_CURRENT_RE, "").trim();
}

function extractTextParts(
  content: string | Array<{ type?: string; text?: string }>,
): string {
  if (typeof content === "string") return normalizeVisibleText(content);
  return normalizeVisibleText(
    content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join(""),
  );
}

function shouldSkipLocalOnlyMessage(turn: TranscriptTurn): boolean {
  return (
    (turn.role === "user" && APPROVE_COMMAND_RE.test(turn.content)) ||
    (turn.role === "assistant" && APPROVAL_ACK_RE.test(turn.content))
  );
}

function isVisibleTranscriptTurn(turn: TranscriptTurn): boolean {
  return turn.content.length > 0 && !shouldHideTranscriptTurn(turn);
}

function toComparableTurn(turn: TranscriptTurn): TranscriptTurn {
  return {
    role: turn.role,
    content: normalizeVisibleText(turn.content),
  };
}

export function shouldHideTranscriptTurn(turn: TranscriptTurn): boolean {
  if (!turn.content.trim()) return true;

  if (turn.role === "user") {
    return (
      CONTEXT_WRAPPER_RE.test(turn.content) ||
      CURRENT_MESSAGE_WRAPPER_RE.test(turn.content) ||
      ASYNC_COMPLETION_WRAPPER_RE.test(turn.content)
    );
  }

  return containsApprovalPrompt(turn.content);
}

async function readSessionStore(): Promise<Record<string, SessionStoreEntry>> {
  try {
    const raw = await fs.readFile(OPENCLAW_SESSIONS_PATH, "utf8");
    return JSON.parse(raw) as Record<string, SessionStoreEntry>;
  } catch {
    return {};
  }
}

async function readTranscriptTurns(sessionFile: string): Promise<TranscriptTurn[]> {
  try {
    const raw = await fs.readFile(sessionFile, "utf8");
    return parseTranscriptTurns(raw);
  } catch {
    return [];
  }
}

function parseTranscriptTurns(raw: string): TranscriptTurn[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionTranscriptEntry)
    .filter(isMessageTranscriptEntry)
    .map((entry) => ({
      role: entry.message.role,
      content: extractTextParts(entry.message.content ?? ""),
    }))
    .filter(isVisibleTranscriptTurn);
}

function isMessageTranscriptEntry(
  entry: SessionTranscriptEntry,
): entry is SessionTranscriptEntry & {
  type: "message";
  message: {
    role: "user" | "assistant";
    content?: string | Array<{ type?: string; text?: string }>;
  };
} {
  return (
    entry.type === "message" &&
    (entry.message?.role === "user" || entry.message?.role === "assistant")
  );
}

export async function loadGatewayConfig(): Promise<GatewayConfig> {
  const raw = await fs.readFile(OPENCLAW_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as {
    gateway?: {
      port?: number;
      auth?: { token?: string };
    };
  };
  const port = parsed.gateway?.port;
  const token = parsed.gateway?.auth?.token?.trim();

  if (!port || !token) {
    throw new Error("OpenClaw Gateway 配置缺失，无法建立会话。");
  }

  return { port, token };
}

export function getOpenClawSessionKey(conversationId: string): string {
  return `webchat:conversation:${conversationId}`;
}

export async function getOpenClawSessionFile(conversationId: string): Promise<string | null> {
  const store = await readSessionStore();
  const sessionKey = getOpenClawSessionKey(conversationId);
  const entry =
    store[sessionKey] ??
    store[`agent:main:${sessionKey}`];
  return entry?.sessionFile ?? null;
}

async function readComparableDbTurns(
  conversationId: string,
): Promise<TranscriptTurn[]> {
  const dbMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  return dbMessages
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }))
    .map(toComparableTurn)
    .filter((turn) => !shouldSkipLocalOnlyMessage(turn))
    .filter(isVisibleTranscriptTurn);
}

function findMissingTranscriptTurns(params: {
  transcriptTurns: TranscriptTurn[];
  comparableDbTurns: TranscriptTurn[];
}) {
  const { transcriptTurns, comparableDbTurns } = params;
  let matched = 0;

  while (
    matched < comparableDbTurns.length &&
    matched < transcriptTurns.length &&
    comparableDbTurns[matched]?.role === transcriptTurns[matched]?.role &&
    comparableDbTurns[matched]?.content === transcriptTurns[matched]?.content
  ) {
    matched += 1;
  }

  return transcriptTurns.slice(matched);
}

async function appendTranscriptTurns(
  conversationId: string,
  turns: TranscriptTurn[],
): Promise<number> {
  if (!turns.length) return 0;

  await prisma.message.createMany({
    data: turns.map((turn) => ({
      conversationId,
      role: turn.role,
      content: turn.content,
    })),
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return turns.length;
}

export async function syncConversationMessagesFromOpenClaw(
  conversationId: string,
): Promise<number> {
  const sessionFile = await getOpenClawSessionFile(conversationId);
  if (!sessionFile) return 0;

  const transcriptTurns = await readTranscriptTurns(sessionFile);
  if (!transcriptTurns.length) return 0;

  const comparableDbTurns = await readComparableDbTurns(conversationId);
  const missingTurns = findMissingTranscriptTurns({
    transcriptTurns,
    comparableDbTurns,
  });

  return await appendTranscriptTurns(conversationId, missingTurns);
}
