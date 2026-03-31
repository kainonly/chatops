"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import type { Attachments } from "@ant-design/x";
import { XProvider } from "@ant-design/x";
import type { BubbleListRef } from "@ant-design/x/es/bubble";
import { useXChat } from "@ant-design/x-sdk";
import { type GetProp, message } from "antd";
import { useSession } from "next-auth/react";
import dayjs from "dayjs";

import { historyMessageFactory } from "../../lib/chatHistory";
import { providerFactory } from "../../lib/chatProvider";
import ChatComposer, { type PastedImage } from "../../lib/components/ChatComposer";
import ChatMessageList from "../../lib/components/ChatMessageList";
import ChatSidebar from "../../lib/components/ChatSidebar";
import { ChatContext } from "../../lib/context";
import zhCN_X from "@ant-design/x/locale/zh_CN";
import zhCN from "antd/locale/zh_CN";
import type { ChatMessage } from "../../lib/types";
import useMarkdownTheme from "../../lib/useMarkdownTheme";

import "@ant-design/x-markdown/themes/dark.css";
import "@ant-design/x-markdown/themes/light.css";

type ConversationItem = {
  key: string;
  label: string;
  group: string;
};

export default function ChatPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [className] = useMarkdownTheme();
  const [messageApi, contextHolder] = message.useMessage();
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<
    GetProp<typeof Attachments, "items">
  >([]);
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const listRef = useRef<BubbleListRef>(null);

  // 加载会话列表
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data: Array<{ id: string; title: string; createdAt: string }>) => {
        setConversations(
          data.map((c) => ({
            key: c.id,
            label: c.title,
            group: dayjs(c.createdAt).isSame(dayjs(), "day")
              ? "今天"
              : dayjs(c.createdAt).format("YYYY-MM-DD"),
          })),
        );
      });
  }, [session?.user?.id]);

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

  const locale = useMemo(() => ({ ...zhCN, ...zhCN_X }), []);

  // 请求完成后拉取最新标题（用于第一条消息生成标题后更新侧边栏）
  const prevRequestingRef = useRef(false);
  useEffect(() => {
    if (prevRequestingRef.current && !isRequesting) {
      fetch(`/api/conversations/${conversationId}`)
        .then((r) => r.json())
        .then((data: { id: string; title: string }) => {
          setConversations((prev) =>
            prev.map((c) =>
              c.key === data.id ? { ...c, label: data.title } : c,
            ),
          );
        });
    }
    prevRequestingRef.current = isRequesting;
  }, [isRequesting, conversationId]);

  const onSubmit = useCallback((value: string) => {
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
  }, [onRequest, pastedImages]);

  const handleActiveChange = useCallback(
    (key: string) => router.push(`/chat/${key}`),
    [router],
  );

  const handleCollapse = useCallback(() => {
    setSideCollapsed((v) => !v);
  }, []);

  const handleAddConversation = useCallback(async () => {
    const res = await fetch("/api/conversations", { method: "POST" });
    const data = await res.json();
    setConversations((prev) => [
      { key: data.id, label: data.title, group: "今天" },
      ...prev,
    ]);
    router.push(`/chat/${data.id}`);
  }, [router]);

  const handleDeleteConversation = useCallback(
    async (key: string) => {
      await fetch(`/api/conversations/${key}`, { method: "DELETE" });
      const newList = conversations.filter((c) => c.key !== key);
      setConversations(newList);
      if (key === conversationId) {
        if (newList.length > 0) {
          router.push(`/chat/${newList[0].key}`);
        } else {
          // 没有会话了，新建一个
          handleAddConversation();
        }
      }
    },
    [conversations, conversationId, router, handleAddConversation],
  );

  return (
    <XProvider locale={locale}>
      <ChatContext.Provider value={chatContextValue}>
        {contextHolder}
        <div className="app-layout">
          <ChatSidebar
            conversations={conversations}
            activeConversationKey={conversationId}
            onActiveChange={handleActiveChange}
            onAddConversation={handleAddConversation}
            onDeleteConversation={handleDeleteConversation}
            messageApi={messageApi}
            avatarUrl={session?.user?.image ?? undefined}
            collapsed={sideCollapsed}
            onCollapse={handleCollapse}
          />
          <div className="app-chat">
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
        </div>
      </ChatContext.Provider>
    </XProvider>
  );
}
