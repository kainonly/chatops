"use client";

import {
} from "@ant-design/icons";
import type { Prompts } from "@ant-design/x";
import type { GetProp } from "antd";

// 输入框上方的快捷提示词
export const SENDER_PROMPTS: GetProp<typeof Prompts, "items"> = [
];

// 思维链状态映射
export const THOUGHT_CHAIN_CONFIG = {
  loading: { title: "正在调用模型", status: "loading" },
  updating: { title: "正在调用模型", status: "loading" },
  success: { title: "大模型执行完成", status: "success" },
  error: { title: "执行失败", status: "error" },
  abort: { title: "已经终止", status: "abort" },
} as const;
