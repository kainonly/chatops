import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../lib/db";
import { normalizeFileMarkdown } from "../../../../lib/fileMarkdown";
import {
  shouldHideTranscriptTurn,
  syncConversationMessagesFromOpenClaw,
} from "../../../../lib/openclaw";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!conversation) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  await syncConversationMessagesFromOpenClaw(id);

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, thinking: true, feedback: true },
  });

  return NextResponse.json(
    messages
      .filter(
        (message) =>
          !shouldHideTranscriptTurn({
            role: message.role as "user" | "assistant",
            content: message.content,
          }),
      )
      .map((message) => ({
        ...message,
        content:
          message.role === "assistant"
            ? normalizeFileMarkdown(message.content)
            : message.content,
      })),
  );
}
