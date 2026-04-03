"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import zhCN from "antd/locale/zh_CN";
import zhCN_X from "@ant-design/x/locale/zh_CN";
import { XProvider } from "@ant-design/x";

import ChatSidebar from "../lib/components/ChatSidebar";
import { ConversationsProvider, useConversations } from "../lib/conversationsContext";

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [sideCollapsed, setSideCollapsed] = useState(false);

  const {
    conversations,
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
      <div className="app-layout">
        <ChatSidebar
          conversations={conversations}
          activeConversationKey={conversationId}
          onActiveChange={handleActiveChange}
          onAddConversation={handleAddConversation}
          onDeleteConversation={handleDelete}
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
