import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { prisma } from "../../../lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session!.user!.id! },
    select: { id: true, title: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  return NextResponse.json(conversation);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  await prisma.conversation.deleteMany({
    where: { id, userId: session!.user!.id! },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;
  const { title } = await req.json();

  const conversation = await prisma.conversation.updateMany({
    where: { id, userId: session!.user!.id! },
    data: { title },
  });

  return NextResponse.json(conversation);
}
