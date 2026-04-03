"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CloudUploadOutlined, CloseOutlined, PaperClipOutlined } from "@ant-design/icons";
import { Attachments, Prompts, Sender } from "@ant-design/x";
import { Button, Flex, type GetProp } from "antd";
import Image from "next/image";

import { SENDER_PROMPTS } from "../config";

export interface PastedImage {
  dataUrl: string;
  name: string;
}

interface ChatComposerProps {
  loading: boolean;
  attachmentsOpen: boolean;
  attachedFiles: GetProp<typeof Attachments, "items">;
  pastedImages: PastedImage[];
  onSubmit: (value: string) => void;
  onAbort: () => void;
  onAttachmentsOpenChange: (open: boolean) => void;
  onAttachedFilesChange: (files: GetProp<typeof Attachments, "items">) => void;
  onPastedImagesChange: React.Dispatch<React.SetStateAction<PastedImage[]>>;
  onPromptClick: (value: string) => void;
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  loading,
  attachmentsOpen,
  attachedFiles,
  pastedImages,
  onSubmit,
  onAbort,
  onAttachmentsOpenChange,
  onAttachedFilesChange,
  onPastedImagesChange,
  onPromptClick,
}) => {
  const senderRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");

  const speechReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // 监听粘贴事件，提取图片
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter((i) => i.type.startsWith("image/"));
      if (!imageItems.length) return;

      e.preventDefault();
      imageItems.forEach((item) => {
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          onPastedImagesChange((current) => [
            ...current,
            { dataUrl, name: file.name || `image-${Date.now()}.png` },
          ]);
        };
        reader.readAsDataURL(file);
      });
    },
    [onPastedImagesChange],
  );

  useEffect(() => {
    const el = senderRef.current;
    if (!el) return;
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const removeImage = useCallback(
    (index: number) => {
      onPastedImagesChange((current) => current.filter((_, i) => i !== index));
    },
    [onPastedImagesChange],
  );

  const handleSubmit = useCallback(() => {
    onSubmit(value);
    setValue("");
  }, [onSubmit, value]);

  const header = useMemo(
    () => (
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
    ),
    [
      attachedFiles,
      attachmentsOpen,
      onAttachedFilesChange,
      onAttachmentsOpenChange,
    ],
  );

  const prefix = useMemo(
    () => (
      <Button
        type="text"
        icon={<PaperClipOutlined style={{ fontSize: 18 }} />}
        onClick={() => onAttachmentsOpenChange(!attachmentsOpen)}
      />
    ),
    [attachmentsOpen, onAttachmentsOpenChange],
  );

  return (
    <Flex vertical gap={12} align="center" style={{ margin: 8 }} ref={senderRef}>
      {!attachmentsOpen && (
        <Prompts
          items={SENDER_PROMPTS}
          onItemClick={(info) => onPromptClick(info.data.description as string)}
          styles={{ item: { padding: "6px 12px" } }}
          className="app-sender-prompt"
        />
      )}
      {pastedImages.length > 0 && (
        <Flex gap={8} wrap className="app-sender app-pasted-images">
          {pastedImages.map((img, i) => (
            <div key={i} className="app-pasted-image-item">
              <Image
                src={img.dataUrl}
                alt={img.name}
                width={240}
                height={160}
                unoptimized
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                className="app-pasted-image-remove"
                onClick={() => removeImage(i)}
              />
            </div>
          ))}
        </Flex>
      )}
      <Sender
        value={value}
        header={header}
        onSubmit={handleSubmit}
        onChange={setValue}
        onCancel={onAbort}
        prefix={prefix}
        loading={loading}
        className="app-sender"
        allowSpeech={speechReady}
        placeholder="提问或输入 / 使用技能"
      />
    </Flex>
  );
};

export default React.memo(ChatComposer);
