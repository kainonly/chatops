"use client";

import React from "react";
import {
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileZipOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FileOutlined,
  GlobalOutlined,
  SyncOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type {
  ActionsFeedbackProps,
  BubbleListProps,
  ThoughtChainItemProps,
} from "@ant-design/x";
import { Actions, Think, ThoughtChain } from "@ant-design/x";
import type { ComponentProps } from "@ant-design/x-markdown";
import XMarkdown from "@ant-design/x-markdown";
import { message, Pagination } from "antd";
import dynamic from "next/dynamic";
import Image from "next/image";

const G2Chart = dynamic(() => import("./G2Chart"), { ssr: false });

const EXT_ICON: Record<string, React.ReactNode> = {
  pdf: <FilePdfOutlined style={{ color: "#ff4d4f" }} />,
  xls: <FileExcelOutlined style={{ color: "#52c41a" }} />,
  xlsx: <FileExcelOutlined style={{ color: "#52c41a" }} />,
  csv: <FileExcelOutlined style={{ color: "#52c41a" }} />,
  doc: <FileWordOutlined style={{ color: "#1677ff" }} />,
  docx: <FileWordOutlined style={{ color: "#1677ff" }} />,
  zip: <FileZipOutlined style={{ color: "#faad14" }} />,
  rar: <FileZipOutlined style={{ color: "#faad14" }} />,
  png: <FileImageOutlined style={{ color: "#722ed1" }} />,
  jpg: <FileImageOutlined style={{ color: "#722ed1" }} />,
  jpeg: <FileImageOutlined style={{ color: "#722ed1" }} />,
  gif: <FileImageOutlined style={{ color: "#722ed1" }} />,
  txt: <FileTextOutlined style={{ color: "#8c8c8c" }} />,
  md: <FileTextOutlined style={{ color: "#8c8c8c" }} />,
};

function FileCard({ href, children }: { href: string; children?: React.ReactNode }) {
  const filename = decodeURIComponent(href.split("/").pop() ?? href);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const icon = EXT_ICON[ext] ?? <FileOutlined style={{ color: "#8c8c8c" }} />;
  const label = typeof children === "string" && children !== href ? children : filename;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid #f0f0f0",
        background: "#fafafa",
        color: "rgba(0,0,0,0.88)",
        textDecoration: "none",
        fontSize: 13,
        maxWidth: 320,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <DownloadOutlined style={{ color: "#8c8c8c", flexShrink: 0 }} />
    </a>
  );
}

import { THOUGHT_CHAIN_CONFIG } from "../config";
import { ChatContext } from "../context";
import type { ChatMessage } from "../types";

// 渲染 AI 回复中的 <think> 标签
const ThinkComponent = React.memo(function ThinkComponent(
  props: ComponentProps,
) {
  const [title, setTitle] = React.useState("深度思考中...");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (props.streamStatus === "done") {
      setTitle("深度思考完成");
      setLoading(false);
    }
  }, [props.streamStatus]);

  return (
    <Think title={title} loading={loading}>
      {props.children}
    </Think>
  );
});

// AI 消息底部操作栏（loading/updating 时隐藏）
const Footer: React.FC<{
  id?: string | number;
  content: string;
  status?: string;
  extraInfo?: ChatMessage["extraInfo"];
}> = ({ id, content, extraInfo, status }) => {
  const context = React.useContext(ChatContext);

  const items = [
    {
      key: "pagination",
      actionRender: <Pagination simple total={1} pageSize={1} />,
    },
    {
      key: "retry",
      label: "重新生成",
      icon: <SyncOutlined />,
      onItemClick: () => {
        if (id) context?.onReload?.(id, { userAction: "retry" });
      },
    },
    {
      key: "copy",
      actionRender: <Actions.Copy text={content} />,
    },
    {
      key: "audio",
      actionRender: (
        <Actions.Audio onClick={() => message.info("当前为模拟功能")} />
      ),
    },
    {
      key: "feedback",
      actionRender: (
        <Actions.Feedback
          styles={{ liked: { color: "#f759ab" } }}
          value={
            (extraInfo?.feedback as ActionsFeedbackProps["value"]) || "default"
          }
          key="feedback"
          onChange={(val) => {
            if (id) {
              context?.setMessage?.(id, () => ({
                extraInfo: { feedback: val },
              }));
              message.success(`${id}: ${val}`);
            } else {
              message.error("has no id!");
            }
          }}
        />
      ),
    },
  ];

  return status !== "updating" && status !== "loading" ? (
    <div style={{ display: "flex" }}>{id && <Actions items={items} />}</div>
  ) : null;
};

// 配置 Bubble.List 的角色渲染：assistant 靠左带 Markdown，user 靠右默认
export const getBubbleRole = (className: string): BubbleListProps["role"] => ({
  assistant: {
    placement: "start",
    header: (_, { status }) => {
      const config =
        THOUGHT_CHAIN_CONFIG[status as keyof typeof THOUGHT_CHAIN_CONFIG];
      return config ? (
        <ThoughtChain.Item
          style={{ marginBottom: 8 }}
          status={config.status as ThoughtChainItemProps["status"]}
          variant="solid"
          icon={<GlobalOutlined />}
          title={config.title}
        />
      ) : null;
    },
    footer: (content, { status, key, extraInfo }) => (
      <Footer
        content={content}
        status={status}
        extraInfo={extraInfo as ChatMessage["extraInfo"]}
        id={key as string}
      />
    ),
    contentRender: (content: string, { status }) => {
      // 列表项之间的空行会触发 Markdown loose list（每项套 <p>），导致间距过大
      // 将列表项（- 或数字.）之间的空行压缩掉
      const normalized = content.replace(
        /((?:^[ \t]*(?:[-*+]|\d+\.)[ \t]+.+\n))\n(?=[ \t]*(?:[-*+]|\d+\.)[ \t]+)/gm,
        "$1",
      );
      return (
        <XMarkdown
          paragraphTag="div"
          components={{
            think: ThinkComponent,
            a: ({ href, children }) => {
              const resolvedHref = typeof href === "string" ? href : undefined;
              return (
                <a
                  href={resolvedHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              );
            },
            code: ({ className: cls, children, streamStatus }) => {
              const lang = /language-(\w+)/.exec(cls ?? "")?.[1];
              if (lang === "g2") {
                if (streamStatus === "loading") return null;
                return <G2Chart config={String(children).trim()} />;
              }
              if (lang === "file") {
                if (streamStatus === "loading") return null;
                try {
                  const { url, name } = JSON.parse(String(children).trim());
                  return <FileCard href={url}>{name}</FileCard>;
                } catch {
                  return <code className={cls}>{children}</code>;
                }
              }
              return <code className={cls}>{children}</code>;
            },
          }}
          className={className}
          streaming={{
            hasNextChunk: status === "updating",
            enableAnimation: true,
          }}
        >
          {normalized}
        </XMarkdown>
      );
    },
  },
  user: {
    placement: "end",
    contentRender: (content) => {
      if (typeof content === "string") return <span>{content}</span>;
      const parts = content as Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          {parts.filter((p) => p.type === "image_url").length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {parts
                .filter((p) => p.type === "image_url")
                .map((p, i) => (
                  <Image
                    key={i}
                    src={(p as { type: "image_url"; image_url: { url: string } }).image_url.url}
                    alt={`上传图片 ${i + 1}`}
                    width={300}
                    height={200}
                    unoptimized
                    style={{ maxHeight: 200, maxWidth: 300, borderRadius: 6, objectFit: "cover" }}
                  />
                ))}
            </div>
          )}
          {parts
            .filter((p) => p.type === "text")
            .map((p, i) => (
              <span key={i}>{(p as { type: "text"; text: string }).text}</span>
            ))}
        </div>
      );
    },
  },
});
