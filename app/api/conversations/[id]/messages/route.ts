import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  // 验证会话属于当前用户
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session!.user!.id! },
  });
  if (!conversation) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, thinking: true, feedback: true },
  });

  return NextResponse.json(messages);
}
