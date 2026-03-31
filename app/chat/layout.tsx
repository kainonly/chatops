"use client";

import React, { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { message } from "antd";
import { useSession } from "next-auth/react";
import zhCN from "antd/locale/zh_CN";
import zhCN_X from "@ant-design/x/locale/zh_CN";
import { XProvider } from "@ant-design/x";
import { useMemo } from "react";

import ChatSidebar from "../lib/components/ChatSidebar";
import { ConversationsProvider, useConversations } from "../lib/conversationsContext";

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [messageApi, contextHolder] = message.useMessage();

  const {
    conversations,
    sideCollapsed,
    setSideCollapsed,
    handleActiveChange,
    handleAddConversation,
    handleDeleteConversation,
  } = useConversations();

  const conversationId = params?.id as string;

  const handleDelete = useCallback(
    async (key: string) => {
      await handleDeleteConversation(key);
      if (key === conversationId) {
        const remaining = conversations.filter((c) => c.key !== key);
        if (remaining.length > 0) {
          router.push(`/chat/${remaining[0].key}`);
        } else {
          handleAddConversation();
        }
      }
    },
    [handleDeleteConversation, conversationId, conversations, router, handleAddConversation],
  );

  const locale = useMemo(() => ({ ...zhCN, ...zhCN_X }), []);

  return (
    <XProvider locale={locale}>
      {contextHolder}
      <div className="app-layout">
        <ChatSidebar
          conversations={conversations}
          activeConversationKey={conversationId}
          onActiveChange={handleActiveChange}
          onAddConversation={handleAddConversation}
          onDeleteConversation={handleDelete}
          messageApi={messageApi}
          avatarUrl={session?.user?.image ?? undefined}
          collapsed={sideCollapsed}
          onCollapse={() => setSideCollapsed(!sideCollapsed)}
        />
        <div className="app-chat">
          {children}
        </div>
      </div>
    </XProvider>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConversationsProvider>
      <ChatLayoutInner>{children}</ChatLayoutInner>
    </ConversationsProvider>
  );
}
