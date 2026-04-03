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

import { isApprovalCommand } from "../../lib/approval";
import { filterVisibleMessages } from "../../lib/chatMessageUtils";
import { historyMessageFactory } from "../../lib/chatHistory";
import { providerFactory } from "../../lib/chatProvider";
import ChatComposer, { type PastedImage } from "../../lib/components/ChatComposer";
import ChatMessageList from "../../lib/components/ChatMessageList";
import { ChatContext } from "../../lib/context";
import { useConversations } from "../../lib/conversationsContext";
import type { ChatMessage } from "../../lib/types";
import { useApprovalFollowupSync } from "../../lib/useApprovalFollowupSync";
import useMarkdownTheme from "../../lib/useMarkdownTheme";

import "@ant-design/x-markdown/themes/dark.css";
import "@ant-design/x-markdown/themes/light.css";

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const { updateConversationTitle } = useConversations();

  const className = useMarkdownTheme();
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<GetProp<typeof Attachments, "items">>([]);
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const listRef = useRef<BubbleListRef>(null);

  const { onRequest, messages, isRequesting, abort, onReload, setMessage, setMessages } =
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

  const { markApprovalRequested } = useApprovalFollowupSync({
    conversationId,
    isRequesting,
    messages,
    listRef,
    setMessages,
  });

  const onSubmit = useCallback(
    (value: string) => {
      type UploadResponse = { url: string; name: string; path: string };
      const isImageName = (name: string) => /\.(png|jpe?g|gif|webp)$/i.test(name);
      const doneFiles = attachedFiles.filter((f) => f.status === "done");

      if (!value && pastedImages.length === 0 && doneFiles.length === 0) return;

      const isApprovalRequest =
        pastedImages.length === 0 && doneFiles.length === 0 && isApprovalCommand(value);

      const imageParts = [
        ...pastedImages.map((img) => ({
          type: "image_url" as const,
          image_url: { url: img.dataUrl },
        })),
        ...doneFiles
          .filter((f) => isImageName(f.name))
          .map((f) => ({
            type: "image_url" as const,
            image_url: { url: (f.response as UploadResponse).url },
          })),
      ];

      const fileRefParts = doneFiles
        .filter((f) => !isImageName(f.name))
        .map((f) => ({
          type: "text" as const,
          text: `[已上传文件：${f.name}，路径：${(f.response as UploadResponse).path}]`,
        }));

      const textPart = value ? [{ type: "text" as const, text: value }] : [];
      const allParts = [...imageParts, ...fileRefParts, ...textPart];
      const content =
        allParts.length === 1 && allParts[0].type === "text"
          ? allParts[0].text
          : allParts;

      onRequest({ messages: [{ role: "user", content }] });
      if (isApprovalRequest) {
        markApprovalRequested();
      }
      setPastedImages([]);
      setAttachedFiles([]);
      listRef.current?.scrollTo({ top: "bottom" });
    },
    [attachedFiles, markApprovalRequested, onRequest, pastedImages, setAttachedFiles],
  );

  const chatContextValue = useMemo(
    () => ({
      onReload,
      setMessage,
      onQuickSubmit: onSubmit,
      isRequesting,
    }),
    [isRequesting, onReload, onSubmit, setMessage],
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

  const visibleMessages = useMemo(
    () => filterVisibleMessages(messages),
    [messages],
  );

  return (
    <ChatContext.Provider value={chatContextValue}>
      <div key={conversationId} className="app-chat-page">
      <ChatMessageList
        className={className}
        listRef={listRef}
        messages={visibleMessages}
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
