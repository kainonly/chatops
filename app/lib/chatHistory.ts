import type { DefaultMessageInfo } from "@ant-design/x-sdk";
import type { ChatMessage } from "./types";

export const historyMessageFactory = async ({
  conversationKey,
}: {
  conversationKey?: string;
}): Promise<DefaultMessageInfo<ChatMessage>[]> => {
  if (!conversationKey) return [];

  const res = await fetch(`/api/conversations/${conversationKey}/messages`);
  if (!res.ok) return [];

  const data: Array<{ id: string; role: string; content: string }> =
    await res.json();

  return data.map((msg) => ({
    id: msg.id,
    status: "success" as const,
    message: { role: msg.role as "user" | "assistant", content: msg.content },
  }));
};
