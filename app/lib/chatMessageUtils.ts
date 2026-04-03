import type { useXChat } from "@ant-design/x-sdk";

import { containsApprovalPrompt, isApprovalCommand } from "./approval";
import type { ChatMessage } from "./types";

type ChatMessages = ReturnType<typeof useXChat<ChatMessage>>["messages"];

function toComparableText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        part?.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("")
    .trim();
}

function isHiddenApprovalMessage(message: {
  role?: string;
  content: ChatMessage["content"];
}): boolean {
  if (message.role === "assistant" && typeof message.content === "string") {
    return containsApprovalPrompt(message.content);
  }

  return (
    message.role === "user" &&
    typeof message.content === "string" &&
    isApprovalCommand(message.content)
  );
}

export function toComparableTurns(list: ChatMessages) {
  return list
    .filter((item) => !isHiddenApprovalMessage(item.message))
    .map((item) => ({
      role: item.message.role,
      content: toComparableText(item.message.content),
    }))
    .filter((item) => item.content.length > 0);
}

export function filterVisibleMessages(list: ChatMessages): ChatMessages {
  return list.filter((item) => !isHiddenApprovalMessage(item.message));
}
