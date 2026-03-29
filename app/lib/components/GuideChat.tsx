"use client";

import React from "react";
import { EllipsisOutlined, ShareAltOutlined } from "@ant-design/icons";
import { Prompts, Welcome } from "@ant-design/x";
import { Button, Flex, Space } from "antd";

import { DESIGN_GUIDE, HOT_TOPICS } from "../config";

interface GuideChatProps {
  onPromptClick: (value: string) => void;
}

const GuideChat: React.FC<GuideChatProps> = ({ onPromptClick }) => {
  return (
    <Flex
      vertical
      style={{ maxWidth: 840 }}
      gap={16}
      align="center"
      className="app-placeholder"
    >
      <Welcome
        style={{ width: "100%" }}
        variant="borderless"
        icon="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*s5sNRo5LjfQAAAAAAAAAAAAADgCCAQ/fmt.webp"
        title="你好，我是 Ant Design X"
        description="基于蚂蚁设计，AGI 产品界面解决方案，打造更好的智能视觉~~"
        extra={
          <Space>
            <Button icon={<ShareAltOutlined />} />
            <Button icon={<EllipsisOutlined />} />
          </Space>
        }
      />
      <Flex gap={16} justify="center" style={{ width: "100%" }}>
        <Prompts
          items={[HOT_TOPICS]}
          styles={{
            list: { height: "100%" },
            item: {
              flex: 1,
              backgroundImage: "linear-gradient(123deg, #e5f4ff 0%, #efe7ff 100%)",
              borderRadius: 12,
              border: "none",
            },
            subItem: { padding: 0, background: "transparent" },
          }}
          onItemClick={(info) =>
            onPromptClick(info.data.description as string)
          }
          className="app-chat-prompt"
        />
        <Prompts
          items={[DESIGN_GUIDE]}
          styles={{
            item: {
              flex: 1,
              backgroundImage: "linear-gradient(123deg, #e5f4ff 0%, #efe7ff 100%)",
              borderRadius: 12,
              border: "none",
            },
            subItem: { background: "#ffffffa6" },
          }}
          onItemClick={(info) =>
            onPromptClick(info.data.description as string)
          }
          className="app-chat-prompt"
        />
      </Flex>
    </Flex>
  );
};

export default GuideChat;
