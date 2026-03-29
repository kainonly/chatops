import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import SessionProviderWrapper from "./lib/components/SessionProviderWrapper";

import "./globals.css";
import "./chat.css";

export const metadata: Metadata = {
  title: "LITHO",
  description: "AI 聊天应用",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <SessionProviderWrapper>{children}</SessionProviderWrapper>
        </AntdRegistry>
      </body>
    </html>
  );
}
