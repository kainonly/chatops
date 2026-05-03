import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { prisma } from "../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

  return NextResponse.json(conversations);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.user.id,
      title: "新对话",
    },
  });

  return NextResponse.json(conversation);
}
