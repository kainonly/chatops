import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { auth } from "../../../auth";
import { prisma } from "../../lib/db";
import {
  getOpenClawSessionKey,
  loadGatewayConfig,
} from "../../lib/openclaw";
import { APPROVE_COMMAND_RE } from "../../lib/approval";

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL!;
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN!;
const execFileAsync = promisify(execFile);

type ChatRequestMessage = {
  role: string;
  content: string;
};

type OpenClawRequestParams = {
  conversationId?: string;
  model?: string;
  messages: Array<{ role: string; content: unknown }>;
  stream: boolean;
};

function jsonErrorResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildOpenClawHeaders(params: {
  conversationId?: string;
  model?: string;
}) {
  const { conversationId, model } = params;

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENCLAW_TOKEN}`,
    ...(conversationId
      ? {
          "x-openclaw-session-key": getOpenClawSessionKey(conversationId),
          "x-openclaw-message-channel": "webchat",
        }
      : {}),
    ...(model ? { "x-openclaw-model": model } : {}),
  };
}

async function callOpenClaw(params: OpenClawRequestParams) {
  const { conversationId, model, messages, stream } = params;

  return await fetch(OPENCLAW_API_URL, {
    method: "POST",
    headers: buildOpenClawHeaders({ conversationId, model }),
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages,
      stream,
      user: conversationId,
    }),
  });
}

function createEventStreamResponse(stream: ReadableStream) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function parseAssistantContentFromStream(response: Response) {
  const reader = response.body!.getReader();
  let assistantContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          controller.enqueue(value);

          const text = new TextDecoder().decode(value);
          for (const line of text.split("\n")) {
            if (!line.startsWith("data:")) continue;

            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) assistantContent += delta;
            } catch {
              // 忽略解析失败的行
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return { stream, getAssistantContent: () => assistantContent };
}

async function ensureConversationAccess(params: {
  conversationId?: string;
  userId: string;
}) {
  const { conversationId, userId } = params;
  if (!conversationId) {
    return { isFirstMessage: false };
  }

  const [conversation, messageCount] = await Promise.all([
    prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  if (!conversation) {
    throw new Error("会话不存在");
  }

  return { isFirstMessage: messageCount === 0 };
}

async function persistConversationReply(params: {
  conversationId?: string;
  lastUserMessage?: ChatRequestMessage;
  assistantContent: string;
  isFirstMessage: boolean;
}) {
  const { conversationId, lastUserMessage, assistantContent, isFirstMessage } = params;
  if (!conversationId || !assistantContent) return;

  await prisma.$transaction([
    ...(lastUserMessage
      ? [
          prisma.message.create({
            data: {
              conversationId,
              role: "user",
              content: lastUserMessage.content,
            },
          }),
        ]
      : []),
    prisma.message.create({
      data: { conversationId, role: "assistant", content: assistantContent },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  if (isFirstMessage && lastUserMessage) {
    generateTitle(lastUserMessage.content).then((title) =>
      prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      }),
    );
  }
}

async function streamOpenClawChat(params: {
  conversationId?: string;
  model?: string;
  reqMessages: Array<{ role: string; content: unknown }>;
  lastUserMessage?: ChatRequestMessage;
  isFirstMessage: boolean;
}) {
  const { conversationId, model, reqMessages, lastUserMessage, isFirstMessage } =
    params;
  const response = await callOpenClaw({
    conversationId,
    model,
    messages: reqMessages,
    stream: true,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonErrorResponse(errorText || "OpenClaw 请求失败", response.status);
  }

  const { stream, getAssistantContent } =
    await parseAssistantContentFromStream(response);
  const trackedStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }

      await persistConversationReply({
        conversationId,
        lastUserMessage,
        assistantContent: getAssistantContent(),
        isFirstMessage,
      });

      controller.close();
    },
  });

  return createEventStreamResponse(trackedStream);
}

async function resolveApprovalViaGateway(rawCommand: string) {
  const match = rawCommand.trim().match(APPROVE_COMMAND_RE);
  if (!match) return null;

  const [, approvalId, rawDecision] = match;
  const decision = rawDecision.toLowerCase() === "always" ? "allow-always" : rawDecision.toLowerCase();
  const { port, token } = await loadGatewayConfig();
  const params = JSON.stringify({ id: approvalId, decision });
  const url = `ws://127.0.0.1:${port}`;

  const callMethod = async (method: "exec.approval.resolve" | "plugin.approval.resolve") => {
    return await execFileAsync("openclaw", [
      "gateway",
      "call",
      method,
      "--json",
      "--url",
      url,
      "--token",
      token,
      "--params",
      params,
    ]);
  };

  try {
    await callMethod(approvalId.startsWith("plugin:") ? "plugin.approval.resolve" : "exec.approval.resolve");
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr
        : String(error);
    const notFound = /unknown or expired approval id|approval_not_found|APPROVAL_NOT_FOUND/i.test(stderr);

    if (!approvalId.startsWith("plugin:") && notFound) {
      await callMethod("plugin.approval.resolve");
    } else {
      throw new Error(stderr.trim() || "审批提交失败");
    }
  }

  return {
    approvalId,
    decision,
  };
}

async function forwardApprovalCommandToOpenClaw(params: {
  conversationId?: string;
  rawCommand: string;
  model?: string;
}) {
  const { conversationId, rawCommand, model } = params;

  return await callOpenClaw({
    conversationId,
    model,
    messages: [{ role: "user", content: rawCommand }],
    stream: true,
  });
}

async function generateTitle(userMessage: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(OPENCLAW_API_URL, {
      method: "POST",
      headers: buildOpenClawHeaders({}),
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `请根据以下对话内容，生成一个简短的会话标题（不超过15个字，不要引号和标点）：\n\n${userMessage}`,
          },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return "新对话";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "新对话";
  } catch {
    return "新对话";
  } finally {
    clearTimeout(timeout);
  }
}

async function handleApprovalRequest(params: {
  conversationId?: string;
  model?: string;
  lastUserMessage?: ChatRequestMessage;
}) {
  const { conversationId, model, lastUserMessage } = params;
  if (typeof lastUserMessage?.content !== "string") {
    return null;
  }

  const approvalResolution = await resolveApprovalViaGateway(
    lastUserMessage.content,
  );
  if (!approvalResolution) return null;

  const forwardedResponse = await forwardApprovalCommandToOpenClaw({
    conversationId,
    rawCommand: lastUserMessage.content,
    model,
  });

  if (!forwardedResponse.ok) {
    const errorText = await forwardedResponse.text();
    return jsonErrorResponse(
      errorText || "审批已提交，但续跑 OpenClaw 失败",
      forwardedResponse.status,
    );
  }

  return forwardedResponse;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();
  const { conversationId, messages: reqMessages = [], model } = body;

  let isFirstMessage = false;
  try {
    ({ isFirstMessage } = await ensureConversationAccess({
      conversationId,
      userId: session!.user!.id!,
    }));
  } catch (error) {
    return jsonErrorResponse(
      error instanceof Error ? error.message : "会话不存在",
      404,
    );
  }

  const lastUserMessage = [...reqMessages]
    .reverse()
    .find((m: { role: string }) => m.role === "user") as
      | ChatRequestMessage
      | undefined;
  const approvalResponse = await handleApprovalRequest({
    conversationId,
    model,
    lastUserMessage,
  });
  if (approvalResponse) {
    return approvalResponse;
  }

  return await streamOpenClawChat({
    conversationId,
    model,
    reqMessages,
    lastUserMessage,
    isFirstMessage,
  });
}
