import { NextRequest } from "next/server";
import { auth } from "../../../auth";
import { prisma } from "../../lib/db";

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL!;
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN!;

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

  const response = await fetch(OPENCLAW_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCLAW_TOKEN}`,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: `当你需要向用户分享、提供或返回一个文件时，必须使用以下格式，不得使用普通 Markdown 链接：
\`\`\`file
{"url":"<文件URL>","name":"<文件名>"}
\`\`\`
仅在明确向用户提供可下载文件时使用此格式。`,
        },
        ...reqMessages,
      ],
      stream: true,
      ...(model && { model }),
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
