"use client";

import React from "react";
import { Button, Typography } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import { signIn } from "next-auth/react";

const { Title, Text } = Typography;

export default function LoginPage() {
  return (
    <div className="login-page">
      {/* 动态背景 */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
      </div>

      {/* 登录卡片 */}
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <MessageOutlined />
          </div>
        </div>

        <Title level={2} className="login-title">
          LITHO
        </Title>
        <Text className="login-subtitle">智能 AI 对话助手，助力高效工作</Text>

        <Button
          type="primary"
          size="large"
          block
          className="login-btn"
          onClick={() => signIn("feishu", { callbackUrl: "/" })}
        >
          <FeishuIcon />
          飞书账号登录
        </Button>

        <Text className="login-footer">点击登录即表示你同意使用条款</Text>
      </div>
    </div>
  );
}

function FeishuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M3.794 6.09c-.78-1.09-.5-1.96.06-2.37a1.247 1.247 0 0 1 1.81.37l5.1 7.84-7 8.07H3.73c-.37 0-.61-.46-.36-.77l5.99-6.9L3.794 6.09Zm8.44 5.56 2.59 3.98a3.56 3.56 0 0 1-.38 4.35l-2.09 2.41c-.25.29-.72.06-.66-.32l.74-4.46a3.56 3.56 0 0 0-.58-2.73l-.93-1.32 1.31-1.91Zm4.34-5.5a4.35 4.35 0 0 1 4.01 2.67l2.19 5.14c.15.36-.26.69-.56.45l-6.33-5.2a2.11 2.11 0 0 1-.2-3.1c.23-.23.54-.41.89-.44V6.14Z" />
    </svg>
  );
}
