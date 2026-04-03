"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dayjs from "dayjs";

export type ConversationItem = {
  key: string;
  label: React.ReactNode;
  group: string;
};

interface ConversationsContextValue {
  conversations: ConversationItem[];
  handleActiveChange: (key: string) => void;
  handleAddConversation: () => Promise<void>;
  handleDeleteConversation: (key: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

function toConversationItem(conversation: {
  id: string;
  title: string;
  createdAt: string;
}): ConversationItem {
  return {
    key: conversation.id,
    label: conversation.title,
    group: dayjs(conversation.createdAt).isSame(dayjs(), "day")
      ? "今天"
      : dayjs(conversation.createdAt).format("YYYY-MM-DD"),
  };
}

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data: Array<{ id: string; title: string; createdAt: string }>) => {
        setConversations(data.map(toConversationItem));
      });
  }, [session?.user?.id]);

  const handleActiveChange = useCallback(
    (key: string) => router.push(`/chat/${key}`),
    [router],
  );

  const handleAddConversation = useCallback(async () => {
    const res = await fetch("/api/conversations", { method: "POST" });
    const data: { id: string; title: string; createdAt?: string } = await res.json();
    setConversations((prev) => [
      toConversationItem({
        id: data.id,
        title: data.title,
        createdAt: data.createdAt ?? new Date().toISOString(),
      }),
      ...prev,
    ]);
    router.push(`/chat/${data.id}`);
  }, [router]);

  const handleDeleteConversation = useCallback(
    async (key: string) => {
      await fetch(`/api/conversations/${key}`, { method: "DELETE" });
      setConversations((prev) => {
        const newList = prev.filter((c) => c.key !== key);
        // 如果删的是当前会话，跳转到第一个或新建
        // 路由跳转交给调用方（layout）处理，这里只更新列表
        return newList;
      });
    },
    [],
  );

  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.key === id ? { ...c, label: title } : c)),
    );
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      handleActiveChange,
      handleAddConversation,
      handleDeleteConversation,
      updateConversationTitle,
    }),
    [
      conversations,
      handleActiveChange,
      handleAddConversation,
      handleDeleteConversation,
      updateConversationTitle,
    ],
  );

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used within ConversationsProvider");
  return ctx;
}
