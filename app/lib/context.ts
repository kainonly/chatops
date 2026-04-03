import React from "react";
import type { useXChat } from "@ant-design/x-sdk";

import type { ChatMessage } from "./types";

export type ChatContextValue = {
  onReload?: ReturnType<typeof useXChat<ChatMessage>>["onReload"];
  setMessage?: ReturnType<typeof useXChat<ChatMessage>>["setMessage"];
  onQuickSubmit?: (value: string) => void;
  isRequesting?: boolean;
};

// 共享 onReload（重试）和 setMessage（更新反馈）给消息操作栏
export const ChatContext = React.createContext<ChatContextValue>({});
