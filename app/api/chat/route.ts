import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { auth } from "../../../auth";
import { prisma } from "../../lib/db";
import {
  getOpenClawSessionKey,
  loadGatewayConfig,
} from "../../lib/openclaw";

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL!;
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN!;
const execFileAsync = promisify(execFile);
const APPROVE_COMMAND_RE =
  /^\/approve(?:@[^\s]+)?\s+([A-Za-z0-9][A-Za-z0-9._:-]*)\s+(allow-once|allow-always|always|deny)\b/i;

function buildStreamingTextResponse(content: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            choices: [{ delta: { content } }],
          })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
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

async function generateTitle(userMessage: string): Promise<string> {
  try {
    const res = await fetch(OPENCLAW_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
      },
      body: JSON.stringify({
        stream: false,
        messages: [
          {
            role: "user",
            content: `请根据以下对话内容，生成一个简短的会话标题（不超过15个字，不要引号和标点）：\n\n${userMessage}`,
          },
        ],
      }),
    });
    if (!res.ok) return "新对话";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "新对话";
  } catch {
    return "新对话";
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();
  const { conversationId, messages: reqMessages = [], model } = body;

  // 验证会话属于当前用户，同时获取当前消息数
  let isFirstMessage = false;
  if (conversationId) {
    const [conversation, messageCount] = await Promise.all([
      prisma.conversation.findFirst({
        where: { id: conversationId, userId: session!.user!.id! },
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);
    if (!conversation) {
      return new Response(JSON.stringify({ error: "会话不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    isFirstMessage = messageCount === 0;
  }

  const lastUserMessage = [...reqMessages]
    .reverse()
    .find((m: { role: string }) => m.role === "user");
  const approvalResolution =
    typeof lastUserMessage?.content === "string"
      ? await resolveApprovalViaGateway(lastUserMessage.content)
      : null;

  if (approvalResolution) {
    const assistantContent = `✅ 审批已提交：${approvalResolution.approvalId} ${approvalResolution.decision}`;

    if (conversationId && lastUserMessage) {
      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId,
            role: "user",
            content: lastUserMessage.content,
          },
        }),
        prisma.message.create({
          data: { conversationId, role: "assistant", content: assistantContent },
        }),
        prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        }),
      ]);
    }

    return buildStreamingTextResponse(assistantContent);
  }

  const response = await fetch(OPENCLAW_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCLAW_TOKEN}`,
      ...(conversationId
        ? {
            "x-openclaw-session-key": getOpenClawSessionKey(conversationId),
            "x-openclaw-message-channel": "webchat",
          }
        : {}),
      ...(model ? { "x-openclaw-model": model } : {}),
    },
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages: reqMessages,
      stream: true,
      user: conversationId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: errorText || "OpenClaw 请求失败" }),
      {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const reader = response.body!.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let assistantContent = "";

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

      // 保存消息
      if (conversationId && assistantContent) {
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

        // 第一条消息：异步生成标题（不阻塞流）
        if (isFirstMessage && lastUserMessage) {
          generateTitle(lastUserMessage.content).then((title) =>
            prisma.conversation.update({
              where: { id: conversationId },
              data: { title },
            }),
          );
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
