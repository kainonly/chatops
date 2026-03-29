"use client";

import React, { useSyncExternalStore } from "react";
import { CloudUploadOutlined, PaperClipOutlined } from "@ant-design/icons";
import { Attachments, Prompts, Sender } from "@ant-design/x";
import { Button, Flex, type GetProp } from "antd";

import { SENDER_PROMPTS } from "../config";

interface ChatComposerProps {
  value: string;
  loading: boolean;
  attachmentsOpen: boolean;
  attachedFiles: GetProp<typeof Attachments, "items">;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  onAttachmentsOpenChange: (open: boolean) => void;
  onAttachedFilesChange: (files: GetProp<typeof Attachments, "items">) => void;
  onPromptClick: (value: string) => void;
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  loading,
  attachmentsOpen,
  attachedFiles,
  onChange,
  onSubmit,
  onAbort,
  onAttachmentsOpenChange,
  onAttachedFilesChange,
  onPromptClick,
}) => {
  // allowSpeech 依赖浏览器 API，延迟启用避免 hydration mismatch
  // 服务端快照返回 false，客户端快照返回 true，天然 hydration 安全
  const speechReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const header = (
    <Sender.Header
      title="上传文件"
      open={attachmentsOpen}
      onOpenChange={onAttachmentsOpenChange}
      styles={{ content: { padding: 0 } }}
    >
      <Attachments
        beforeUpload={() => false}
        items={attachedFiles}
        onChange={(info) => onAttachedFilesChange(info.fileList)}
        placeholder={(type) =>
          type === "drop"
            ? { title: "将文件拖到此处" }
            : {
                icon: <CloudUploadOutlined />,
                title: "上传文件",
                description: "点击或将文件拖到此处上传",
              }
        }
      />
    </Sender.Header>
  );

  return (
    <Flex vertical gap={12} align="center" style={{ margin: 8 }}>
      {!attachmentsOpen && (
        <Prompts
          items={SENDER_PROMPTS}
          onItemClick={(info) => onPromptClick(info.data.description as string)}
          styles={{ item: { padding: "6px 12px" } }}
          className="app-sender-prompt"
        />
      )}
      <Sender
        value={value}
        header={header}
        onSubmit={onSubmit}
        onChange={onChange}
        onCancel={onAbort}
        prefix={
          <Button
            type="text"
            icon={<PaperClipOutlined style={{ fontSize: 18 }} />}
            onClick={() => onAttachmentsOpenChange(!attachmentsOpen)}
          />
        }
        loading={loading}
        className="app-sender"
        allowSpeech={speechReady}
        placeholder="提问或输入 / 使用技能"
      />
    </Flex>
  );
};

export default ChatComposer;
