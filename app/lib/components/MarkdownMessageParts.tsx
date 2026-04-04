"use client";

import React from "react";
import {
  GlobalOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type {
  ActionsFeedbackProps,
  BubbleListProps,
  ThoughtChainItemProps,
} from "@ant-design/x";
import { Actions, CodeHighlighter, FileCard as XFileCard, Think, ThoughtChain } from "@ant-design/x";
import type { ComponentProps } from "@ant-design/x-markdown";
import XMarkdown from "@ant-design/x-markdown";
import { Button, message, Pagination, Space } from "antd";
import dynamic from "next/dynamic";
import Image from "next/image";

const G2Chart = dynamic(() => import("./G2Chart"), { ssr: false });
const Mermaid = dynamic(() => import("./Mermaid"), { ssr: false });

function FileDownloadCard({ href, name }: { href: string; name: string }) {
  return (
    <XFileCard
      name={name}
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      style={{ cursor: "pointer" }}
    />
  );
}

import { THOUGHT_CHAIN_CONFIG } from "../config";
import { ChatContext } from "../context";
import { extractApprovalContent } from "../approval";
import { normalizeFileMarkdown } from "../fileMarkdown";
import type { ChatMessage } from "../types";

type UserMessagePart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function normalizeAssistantContent(content: string): string {
  const approvalContent = extractApprovalContent(content);

  return normalizeFileMarkdown(approvalContent?.content ?? content).replace(
    /((?:^[ \t]*(?:[-*+]|\d+\.)[ \t]+.+\n))\n(?=[ \t]*(?:[-*+]|\d+\.)[ \t]+)/gm,
    "$1",
  );
}

function renderMarkdownLink(href: string | undefined, children: React.ReactNode) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function renderMarkdownCode(params: {
  className?: string;
  children: React.ReactNode;
  streamStatus?: string;
}) {
  const { className, children, streamStatus } = params;
  const codeLang = /language-(\w+)/.exec(className ?? "")?.[1];

  if (streamStatus === "loading" && ["g2", "mermaid", "file"].includes(codeLang ?? "")) {
    return null;
  }

  if (codeLang === "g2") {
    return <G2Chart config={String(children).trim()} />;
  }

  if (codeLang === "mermaid") {
    return <Mermaid>{String(children)}</Mermaid>;
  }

  if (codeLang === "file") {
    try {
      const { url, name } = JSON.parse(String(children).trim());
      return <FileDownloadCard href={url} name={name} />;
    } catch {
      return <code className={className}>{children}</code>;
    }
  }

  if (codeLang) {
    return <CodeHighlighter lang={codeLang}>{String(children)}</CodeHighlighter>;
  }

  return <code className={className}>{children}</code>;
}

function renderUserMessageContent(content: ChatMessage["content"]) {
  if (typeof content === "string") return <span>{content}</span>;

  const parts = content as unknown as UserMessagePart[];
  const imageParts = parts.filter(
    (part): part is Extract<UserMessagePart, { type: "image_url" }> =>
      part.type === "image_url",
  );
  const textParts = parts.filter(
    (part): part is Extract<UserMessagePart, { type: "text" }> =>
      part.type === "text",
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      {imageParts.length > 0 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {imageParts.map((part, index) => (
            <Image
              key={index}
              src={part.image_url.url}
              alt={`上传图片 ${index + 1}`}
              width={300}
              height={200}
              unoptimized
              style={{ maxHeight: 200, maxWidth: 300, borderRadius: 6, objectFit: "cover" }}
            />
          ))}
        </div>
      ) : null}
      {textParts.map((part, index) => (
        <span key={index}>{part.text}</span>
      ))}
    </div>
  );
}

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

const APPROVAL_ACTIONS_MARKER = "[[APPROVAL_ACTIONS]]";

// 审批交互卡片，替换消息中的 [[APPROVAL_ACTIONS]] 占位符
const ApprovalCard: React.FC<{ requestId: string }> = ({ requestId }) => {
  const context = React.useContext(ChatContext);
  const submit = (decision: string) => {
    context.onQuickSubmit?.(`/approve ${requestId} ${decision}`);
  };

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 8,
        border: "1px solid #d9d9d9",
        background: "#fafafa",
        margin: "6px 0",
      }}
    >
      <span style={{ fontSize: 12, color: "#8c8c8c" }}>
        工具执行请求 · ID: <code style={{ fontSize: 11 }}>{requestId}</code>
      </span>
      <Space>
        <Button
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => submit("allow-once")}
          disabled={context.isRequesting}
        >
          允许一次
        </Button>
        <Button
          size="small"
          icon={<ClockCircleOutlined />}
          onClick={() => submit("allow-always")}
          disabled={context.isRequesting}
        >
          总是允许
        </Button>
        <Button
          size="small"
          danger
          icon={<CloseCircleOutlined />}
          onClick={() => submit("deny")}
          disabled={context.isRequesting}
        >
          拒绝
        </Button>
      </Space>
    </div>
  );
};

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
      const mdComponents = {
        think: ThinkComponent,
        a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
          renderMarkdownLink(typeof href === "string" ? href : undefined, children),
        code: ({
          className: markdownClassName,
          children,
          streamStatus,
        }: {
          className?: string;
          children?: React.ReactNode;
          streamStatus?: string;
        }) =>
          renderMarkdownCode({ className: markdownClassName, children, streamStatus }),
      };
      const streamingProps = {
        hasNextChunk: status === "updating",
        enableAnimation: true,
      };

      const approvalData = extractApprovalContent(content);
      if (approvalData) {
        const parts = approvalData.content.split(APPROVAL_ACTIONS_MARKER);
        return (
          <div>
            {parts.map((part, i) => (
              <React.Fragment key={i}>
                {part.trim() && (
                  <XMarkdown
                    paragraphTag="div"
                    components={mdComponents}
                    className={className}
                    streaming={streamingProps}
                  >
                    {part.replace(
                      /((?:^[ \t]*(?:[-*+]|\d+\.)[ \t]+.+\n))\n(?=[ \t]*(?:[-*+]|\d+\.)[ \t]+)/gm,
                      "$1",
                    )}
                  </XMarkdown>
                )}
                {i < parts.length - 1 && (
                  <ApprovalCard requestId={approvalData.requestId} />
                )}
              </React.Fragment>
            ))}
          </div>
        );
      }

      return (
        <XMarkdown
          paragraphTag="div"
          components={mdComponents}
          className={className}
          streaming={streamingProps}
        >
          {normalizeAssistantContent(content)}
        </XMarkdown>
      );
    },
  },
  user: {
    placement: "end",
    contentRender: renderUserMessageContent,
  },
});
