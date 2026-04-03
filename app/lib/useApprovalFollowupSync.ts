"use client";

import React from "react";
import type { BubbleListRef } from "@ant-design/x/es/bubble";
import type { useXChat } from "@ant-design/x-sdk";

import { toComparableTurns } from "./chatMessageUtils";
import type { ChatMessage } from "./types";

const APPROVAL_FOLLOWUP_POLL_MS = 2500;
const APPROVAL_FOLLOWUP_POLL_WINDOW_MS = 90_000;

type ChatMessages = ReturnType<typeof useXChat<ChatMessage>>["messages"];

export function useApprovalFollowupSync(params: {
  conversationId: string;
  isRequesting: boolean;
  messages: ChatMessages;
  listRef: React.RefObject<BubbleListRef | null>;
  setMessages: ReturnType<typeof useXChat<ChatMessage>>["setMessages"];
}) {
  const { conversationId, isRequesting, messages, listRef, setMessages } = params;
  const [approvalPollingToken, setApprovalPollingToken] = React.useState(0);
  const messagesRef = React.useRef<ChatMessages>([]);
  const approvalPollUntilRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const markApprovalRequested = React.useCallback(() => {
    approvalPollUntilRef.current = Date.now() + APPROVAL_FOLLOWUP_POLL_WINDOW_MS;
    setApprovalPollingToken((current) => current + 1);
  }, []);

  React.useEffect(() => {
    if (isRequesting || approvalPollingToken === 0) return;
    if (
      !approvalPollUntilRef.current ||
      Date.now() >= approvalPollUntilRef.current
    ) {
      approvalPollUntilRef.current = null;
      return;
    }

    let cancelled = false;

    const syncFollowupMessages = async () => {
      if (
        cancelled ||
        !approvalPollUntilRef.current ||
        Date.now() >= approvalPollUntilRef.current
      ) {
        approvalPollUntilRef.current = null;
        return;
      }

      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;

      const data: Array<{ id: string; role: string; content: string }> =
        await response.json();
      if (cancelled) return;

      const fetchedMessages = data.map((msg) => ({
        id: msg.id,
        status: "success" as const,
        message: {
          role: msg.role as "user" | "assistant",
          content: msg.content,
        },
      }));
      const currentMessages = messagesRef.current;
      const currentTurns = toComparableTurns(currentMessages);
      const fetchedTurns = toComparableTurns(fetchedMessages);

      let matched = 0;
      while (
        matched < currentTurns.length &&
        matched < fetchedTurns.length &&
        currentTurns[matched]?.role === fetchedTurns[matched]?.role &&
        currentTurns[matched]?.content === fetchedTurns[matched]?.content
      ) {
        matched += 1;
      }

      if (matched === currentTurns.length) {
        const missingMessages = fetchedMessages.slice(matched);
        if (missingMessages.length > 0) {
          const nextMessages = [...currentMessages, ...missingMessages];
          messagesRef.current = nextMessages;
          setMessages(nextMessages);
          listRef.current?.scrollTo({ top: "bottom" });
        }
        return;
      }

      messagesRef.current = fetchedMessages;
      setMessages(fetchedMessages);
    };

    void syncFollowupMessages();
    const timer = window.setInterval(() => {
      void syncFollowupMessages();
    }, APPROVAL_FOLLOWUP_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [approvalPollingToken, conversationId, isRequesting, listRef, setMessages]);

  return { markApprovalRequested };
}
