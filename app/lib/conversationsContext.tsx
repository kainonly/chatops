"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dayjs from "dayjs";

export type ConversationItem = {
  key: string;
  label: string;
  group: string;
};

interface ConversationsContextValue {
  conversations: ConversationItem[];
  sideCollapsed: boolean;
  setSideCollapsed: (v: boolean) => void;
  handleActiveChange: (key: string) => void;
  handleAddConversation: () => Promise<void>;
  handleDeleteConversation: (key: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [sideCollapsed, setSideCollapsed] = useState(false);

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

  const handleActiveChange = useCallback(
    (key: string) => router.push(`/chat/${key}`),
    [router],
  );

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

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        sideCollapsed,
        setSideCollapsed,
        handleActiveChange,
        handleAddConversation,
        handleDeleteConversation,
        updateConversationTitle,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used within ConversationsProvider");
  return ctx;
}
