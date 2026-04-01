import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { prisma } from "./db";

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");
const OPENCLAW_SESSIONS_PATH = path.join(
  os.homedir(),
  ".openclaw",
  "agents",
  "main",
  "sessions",
  "sessions.json",
);
const APPROVE_COMMAND_RE =
  /^\/approve(?:@[^\s]+)?\s+([A-Za-z0-9][A-Za-z0-9._:-]*)\s+(allow-once|allow-always|always|deny)\b/i;
const APPROVAL_ACK_RE = /^✅ 审批已提交：/;
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
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as {
        type?: string;
        message?: {
          role?: string;
          content?: string | Array<{ type?: string; text?: string }>;
        };
      })
      .filter(
        (entry) =>
          entry.type === "message" &&
          (entry.message?.role === "user" || entry.message?.role === "assistant"),
      )
      .map((entry) => ({
        role: entry.message!.role as "user" | "assistant",
        content: extractTextParts(entry.message?.content ?? ""),
      }))
      .filter((entry) => entry.content.length > 0);
  } catch {
    return [];
  }
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
  const entry = store[getOpenClawSessionKey(conversationId)];
  return entry?.sessionFile ?? null;
}

export async function syncConversationMessagesFromOpenClaw(
  conversationId: string,
): Promise<number> {
  const sessionFile = await getOpenClawSessionFile(conversationId);
  if (!sessionFile) return 0;

  const transcriptTurns = await readTranscriptTurns(sessionFile);
  if (!transcriptTurns.length) return 0;

  const dbMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const comparableDbTurns = dbMessages
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: normalizeVisibleText(message.content),
    }))
    .filter((turn) => !shouldSkipLocalOnlyMessage(turn));

  let matched = 0;
  while (
    matched < comparableDbTurns.length &&
    matched < transcriptTurns.length &&
    comparableDbTurns[matched]?.role === transcriptTurns[matched]?.role &&
    comparableDbTurns[matched]?.content === transcriptTurns[matched]?.content
  ) {
    matched += 1;
  }

  const missingTurns = transcriptTurns.slice(matched);
  if (!missingTurns.length) return 0;

  await prisma.message.createMany({
    data: missingTurns.map((turn) => ({
      conversationId,
      role: turn.role,
      content: turn.content,
    })),
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return missingTurns.length;
}
