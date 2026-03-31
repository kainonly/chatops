"use client";

import React from "react";
import { Bubble } from "@ant-design/x";
import type { BubbleListRef } from "@ant-design/x/es/bubble";
import type { useXChat } from "@ant-design/x-sdk";

import type { ChatMessage } from "../types";

// TODO: GuideChat 暂时不显示，后续启用
// import GuideChat from "./GuideChat";
import { getBubbleRole } from "./MarkdownMessageParts";

type ChatMessages = ReturnType<typeof useXChat<ChatMessage>>["messages"];

interface ChatMessageListProps {
  className: string;
  listRef: React.RefObject<BubbleListRef | null>;
  messages: ChatMessages;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  className,
  listRef,
  messages,
}) => {
  const items = React.useMemo(
    () =>
      messages.map((item) => ({
        ...item.message,
        key: item.id,
        status: item.status,
        loading: item.status === "loading",
        extraInfo: item.extraInfo as ChatMessage["extraInfo"],
      })),
    [messages],
  );

  const role = React.useMemo(() => getBubbleRole(className), [className]);

  return (
    <div className="app-chat-list">
      {items.length ? (
        <Bubble.List
          ref={listRef}
          items={items}
          className="app-bubble-list"
          role={role}
        />
      ) : null}
    </div>
  );
};

export default React.memo(ChatMessageList);
