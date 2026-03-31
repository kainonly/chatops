import type { DefaultMessageInfo } from "@ant-design/x-sdk";
import type { ChatMessage } from "./types";

function getMessagesUrl(conversationKey: string): string {
  const path = `/api/conversations/${conversationKey}/messages`;

  if (typeof window !== "undefined") {
    return path;
  }

  const baseUrl = process.env.AUTH_URL;
  if (!baseUrl) {
    throw new Error("AUTH_URL is required for server-side message loading.");
  }

  return new URL(path, baseUrl).toString();
}

export const historyMessageFactory = async ({
  conversationKey,
}: {
  conversationKey?: string;
}): Promise<DefaultMessageInfo<ChatMessage>[]> => {
  if (!conversationKey) return [];

  const res = await fetch(getMessagesUrl(conversationKey));
  if (!res.ok) return [];

  const data: Array<{ id: string; role: string; content: string }> =
    await res.json();

  return data.map((msg) => ({
    id: msg.id,
    status: "success" as const,
    message: { role: msg.role as "user" | "assistant", content: msg.content },
  }));
};
