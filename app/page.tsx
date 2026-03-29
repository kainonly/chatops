import { redirect } from "next/navigation";
import { auth } from "../auth";
import { prisma } from "./lib/db";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 取最近一条会话
  let conversation = await prisma.conversation.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  // 没有则自动新建
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { userId: session.user.id, title: "新对话" },
    });
  }

  redirect(`/chat/${conversation.id}`);
}
