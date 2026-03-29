"use client";

import React from "react";
import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Avatar, Button } from "antd";
import type { MessageInstance } from "antd/es/message/interface";

type ConversationItem = {
  key: string;
  label?: React.ReactNode;
  group?: string;
  [key: string]: unknown;
};

interface ChatSidebarProps {
  conversations: ConversationItem[];
  activeConversationKey: string;
  onActiveChange: (key: string) => void;
  onAddConversation: () => void;
  onDeleteConversation: (key: string) => void;
  messageApi: MessageInstance;
  avatarUrl?: string;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationKey,
  onActiveChange,
  onAddConversation,
  onDeleteConversation,
  messageApi,
  avatarUrl,
}) => {
  return (
    <div className="app-side">
      <div className="app-logo">
        <MessageOutlined className="app-logo-icon" />
        <span className="app-logo-text">LITHO</span>
      </div>

      <Conversations
        creation={{
          onClick: onAddConversation,
        }}
        items={conversations.map(({ key, label, ...other }) => ({
          key,
          label: key === activeConversationKey ? `[当前对话]${label}` : label,
          ...other,
        }))}
        className="app-conversations"
        activeKey={activeConversationKey}
        onActiveChange={onActiveChange}
        groupable
        styles={{ item: { padding: "0 8px" } }}
        menu={(conversation) => ({
          items: [
            {
              label: "删除",
              key: "delete",
              icon: <DeleteOutlined />,
              danger: true,
              onClick: () => onDeleteConversation(conversation.key),
            },
          ],
        })}
      />

      <div className="app-side-footer">
        <Avatar size={24} src={avatarUrl} />
        <Button type="text" icon={<QuestionCircleOutlined />} />
      </div>
    </div>
  );
};

export default ChatSidebar;
