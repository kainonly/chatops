"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import type { Attachments } from "@ant-design/x";
import type { BubbleListRef } from "@ant-design/x/es/bubble";
import { useXChat } from "@ant-design/x-sdk";
import { type GetProp } from "antd";

import { historyMessageFactory } from "../../lib/chatHistory";
import { providerFactory } from "../../lib/chatProvider";
import ChatComposer, { type PastedImage } from "../../lib/components/ChatComposer";
import ChatMessageList from "../../lib/components/ChatMessageList";
import { ChatContext } from "../../lib/context";
import { useConversations } from "../../lib/conversationsContext";
import type { ChatMessage } from "../../lib/types";
import useMarkdownTheme from "../../lib/useMarkdownTheme";

import "@ant-design/x-markdown/themes/dark.css";
import "@ant-design/x-markdown/themes/light.css";

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const { updateConversationTitle } = useConversations();

  const [className] = useMarkdownTheme();
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<GetProp<typeof Attachments, "items">>([]);
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const listRef = useRef<BubbleListRef>(null);

  const { onRequest, messages, isRequesting, abort, onReload, setMessage } =
    useXChat<ChatMessage>({
      provider: providerFactory(conversationId),
      conversationKey: conversationId,
      defaultMessages: historyMessageFactory,
      requestPlaceholder: () => ({
        content: "暂无数据",
        role: "assistant",
      }),
      requestFallback: (_, { error, errorInfo, messageInfo }) => {
        if (error.name === "AbortError") {
          return {
            content: messageInfo?.message?.content || "请求已中止",
            role: "assistant",
          };
        }
        return {
          content: errorInfo?.error?.message || "请求失败，请重试！",
          role: "assistant",
        };
      },
    });

  const chatContextValue = useMemo(
    () => ({ onReload, setMessage }),
    [onReload, setMessage],
  );

  // 请求完成后更新侧边栏标题
  const prevRequestingRef = useRef(false);
  React.useEffect(() => {
    if (prevRequestingRef.current && !isRequesting) {
      fetch(`/api/conversations/${conversationId}`)
        .then((r) => r.json())
        .then((data: { id: string; title: string }) => {
          updateConversationTitle(data.id, data.title);
        });
    }
    prevRequestingRef.current = isRequesting;
  }, [isRequesting, conversationId, updateConversationTitle]);

  const onSubmit = useCallback(
    (value: string) => {
      if (!value && pastedImages.length === 0) return;
      const content =
        pastedImages.length > 0
          ? [
              ...pastedImages.map((img) => ({
                type: "image_url" as const,
                image_url: { url: img.dataUrl },
              })),
              ...(value ? [{ type: "text" as const, text: value }] : []),
            ]
          : value;
      onRequest({ messages: [{ role: "user", content }] });
      setPastedImages([]);
      listRef.current?.scrollTo({ top: "bottom" });
    },
    [onRequest, pastedImages],
  );

  return (
    <ChatContext.Provider value={chatContextValue}>
      <div key={conversationId} className="app-chat-page">
      <ChatMessageList
        className={className}
        listRef={listRef}
        messages={messages}
      />
      <ChatComposer
        loading={isRequesting}
        attachmentsOpen={attachmentsOpen}
        attachedFiles={attachedFiles}
        pastedImages={pastedImages}
        onSubmit={onSubmit}
        onAbort={abort}
        onAttachmentsOpenChange={setAttachmentsOpen}
        onAttachedFilesChange={setAttachedFiles}
        onPastedImagesChange={setPastedImages}
        onPromptClick={onSubmit}
      />
      </div>
    </ChatContext.Provider>
  );
}
