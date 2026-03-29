"use client";

import React from "react";
import { Button, Card, Typography } from "antd";
import { signIn } from "next-auth/react";

const { Title } = Typography;

export default function LoginPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Card style={{ width: 400, borderRadius: 12, textAlign: "center" }}>
        <Title level={3} style={{ marginBottom: 32 }}>
          LITHO
        </Title>
        <Button
          type="primary"
          size="large"
          block
          onClick={() => signIn("feishu", { callbackUrl: "/" })}
        >
          飞书账号登录
        </Button>
      </Card>
    </div>
  );
}
