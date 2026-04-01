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

const APPROVE_COMMAND_RE =
  /^\/approve(?:@[^\s]+)?\s+[A-Za-z0-9][A-Za-z0-9._:-]*\s+(allow-once|allow-always|always|deny)\b/i;
const APPROVAL_FOLLOWUP_POLL_MS = 2500;
const APPROVAL_FOLLOWUP_POLL_WINDOW_MS = 90_000;

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

function toComparableTurns(
  list: ReturnType<typeof useXChat<ChatMessage>>["messages"],
) {
  return list
    .map((item) => ({
      role: item.message.role,
      content: toComparableText(item.message.content),
    }))
    .filter((item) => item.content.length > 0);
}

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const { updateConversationTitle } = useConversations();

  const [className] = useMarkdownTheme();
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<GetProp<typeof Attachments, "items">>([]);
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const [approvalPollingToken, setApprovalPollingToken] = useState(0);
  const listRef = useRef<BubbleListRef>(null);
  const messagesRef = useRef<ReturnType<typeof useXChat<ChatMessage>>["messages"]>([]);
  const approvalPollUntilRef = useRef<number | null>(null);

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

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const onSubmit = useCallback(
    (value: string) => {
      if (!value && pastedImages.length === 0) return;
      const isApprovalCommand =
        pastedImages.length === 0 && APPROVE_COMMAND_RE.test(value.trim());
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
      if (isApprovalCommand) {
        approvalPollUntilRef.current =
          Date.now() + APPROVAL_FOLLOWUP_POLL_WINDOW_MS;
        setApprovalPollingToken((current) => current + 1);
      }
      setPastedImages([]);
      listRef.current?.scrollTo({ top: "bottom" });
    },
    [onRequest, pastedImages],
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
  }, [approvalPollingToken, conversationId, isRequesting, setMessages]);

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
