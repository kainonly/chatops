"use client";

import React from "react";
import {
  DeleteOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PlusOutlined,
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
  collapsed?: boolean;
  onCollapse?: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationKey,
  onActiveChange,
  onAddConversation,
  onDeleteConversation,
  messageApi,
  avatarUrl,
  collapsed = false,
  onCollapse,
}) => {
  return (
    <div className={`app-side${collapsed ? " app-side-collapsed" : ""}`}>
      <div className="app-logo">
        {!collapsed && (
          <>
            <MessageOutlined className="app-logo-icon" />
            <span className="app-logo-text">LITHO</span>
          </>
        )}
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onCollapse}
          className="app-side-collapse-btn"
        />
      </div>

      {collapsed ? (
        <div className="app-side-collapsed-actions">
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={onAddConversation}
            title="新增会话"
          />
          <Avatar size={24} src={avatarUrl} style={{ cursor: "default" }} />
        </div>
      ) : (
        <>
          <Conversations
            creation={{
              label: "新增会话",
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
        </>
      )}
    </div>
  );
};

export default ChatSidebar;
