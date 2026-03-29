"use client";

import {
  AppstoreAddOutlined,
  CommentOutlined,
  FileSearchOutlined,
  HeartOutlined,
  PaperClipOutlined,
  ProductOutlined,
  ScheduleOutlined,
  SmileOutlined,
} from "@ant-design/icons";
import type { Prompts } from "@ant-design/x";
import type { DefaultMessageInfo } from "@ant-design/x-sdk";
import type { GetProp } from "antd";

import type { ChatMessage } from "./types";

// 预设历史消息（模拟数据，后续从后端加载）
export const HISTORY_MESSAGES: Record<
  string,
  DefaultMessageInfo<ChatMessage>[]
> = {
  "default-1": [
    {
      message: { role: "user", content: "如何" },
      status: "success",
    },
  ],
};

// 默认会话列表
export const DEFAULT_CONVERSATIONS_ITEMS = [
  { key: "default-0", label: "默认对话", group: "今天" },
];

// GuideChat 欢迎页 - 热门话题
export const HOT_TOPICS = {
  key: "1",
  label: "热门话题",
  children: [
    {
      key: "1-1",
      description: "Ant Design X 中有哪些组件？",
      icon: <span style={{ color: "#f93a4a", fontWeight: 700 }}>1</span>,
    },
    {
      key: "1-2",
      description: "新的 AGI 混合界面",
      icon: <span style={{ color: "#ff6565", fontWeight: 700 }}>2</span>,
    },
    {
      key: "1-3",
      description: "Ant Design X 中有哪些组件？",
      icon: <span style={{ color: "#ff8f1f", fontWeight: 700 }}>3</span>,
    },
    {
      key: "1-4",
      description: "快来发现 AI 时代的新设计范式。",
      icon: <span style={{ color: "#00000040", fontWeight: 700 }}>4</span>,
    },
    {
      key: "1-5",
      description: "如何快速安装和导入组件？",
      icon: <span style={{ color: "#00000040", fontWeight: 700 }}>5</span>,
    },
  ],
};

// GuideChat 欢迎页 - 设计指南（RICH 理念）
export const DESIGN_GUIDE = {
  key: "2",
  label: "设计指南",
  children: [
    {
      key: "2-1",
      icon: <HeartOutlined />,
      label: "意图",
      description: "AI理解用户需求并提供解决方案",
    },
    {
      key: "2-2",
      icon: <SmileOutlined />,
      label: "角色",
      description: "AI的公众形象",
    },
    {
      key: "2-3",
      icon: <CommentOutlined />,
      label: "对话",
      description: "AI如何以用户理解的方式表达自己",
    },
    {
      key: "2-4",
      icon: <PaperClipOutlined />,
      label: "界面",
      description: 'AI平衡"聊天"和"执行"行为',
    },
  ],
};

// 输入框上方的快捷提示词
export const SENDER_PROMPTS: GetProp<typeof Prompts, "items"> = [
  // { key: "1", description: "升级", icon: <ScheduleOutlined /> },
  // { key: "2", description: "组件", icon: <ProductOutlined /> },
  // { key: "3", description: "RICH 指南", icon: <FileSearchOutlined /> },
  // { key: "4", description: "安装介绍", icon: <AppstoreAddOutlined /> },
];

// 思维链状态映射
export const THOUGHT_CHAIN_CONFIG = {
  loading: { title: "正在调用模型", status: "loading" },
  updating: { title: "正在调用模型", status: "loading" },
  success: { title: "大模型执行完成", status: "success" },
  error: { title: "执行失败", status: "error" },
  abort: { title: "已经终止", status: "abort" },
} as const;
