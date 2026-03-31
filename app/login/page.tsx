"use client";

import { LockOutlined } from "@ant-design/icons";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="login-page">
      {/* 背景光晕 */}
      <div className="login-bg-glow login-bg-glow-primary" aria-hidden="true" />
      <div className="login-bg-glow login-bg-glow-tertiary" aria-hidden="true" />

      {/* 登录卡片 */}
      <div className="login-card">
        {/* Logo / 品牌 */}
        <div className="login-brand">
          <span className="login-brand-dot" aria-hidden="true" />
          <span className="login-brand-name">LITHO</span>
        </div>

        <h1 className="login-headline">Welcome back.</h1>
        <p className="login-sub">Sign in to continue to your workspace.</p>

        <div className="login-actions">
          <button
            className="login-btn-feishu"
            onClick={() => signIn("feishu", { callbackUrl: "/" })}
          >
            <FeishuIcon />
            <span>Continue with Feishu</span>
          </button>
          <button className="login-btn-sso">
            <LockOutlined style={{ fontSize: 14 }} />
            <span>SSO Login</span>
          </button>
        </div>
      </div>

      {/* 底部链接 */}
      <footer className="login-footer">
        <span className="login-footer-link">Help</span>
        <span className="login-footer-sep" aria-hidden="true" />
        <span className="login-footer-link">Privacy</span>
        <span className="login-footer-sep" aria-hidden="true" />
        <span className="login-footer-link">Terms</span>
      </footer>
    </div>
  );
}

function FeishuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M3.794 6.09c-.78-1.09-.5-1.96.06-2.37a1.247 1.247 0 0 1 1.81.37l5.1 7.84-7 8.07H3.73c-.37 0-.61-.46-.36-.77l5.99-6.9L3.794 6.09Zm8.44 5.56 2.59 3.98a3.56 3.56 0 0 1-.38 4.35l-2.09 2.41c-.25.29-.72.06-.66-.32l.74-4.46a3.56 3.56 0 0 0-.58-2.73l-.93-1.32 1.31-1.91Zm4.34-5.5a4.35 4.35 0 0 1 4.01 2.67l2.19 5.14c.15.36-.26.69-.56.45l-6.33-5.2a2.11 2.11 0 0 1-.2-3.1c.23-.23.54-.41.89-.44V6.14Z" />
    </svg>
  );
}
