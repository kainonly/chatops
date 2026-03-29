import type { ActionsFeedbackProps } from "@ant-design/x";
import type { XModelMessage } from "@ant-design/x-sdk";

// 扩展消息类型，增加点赞/点踩反馈
export interface ChatMessage extends XModelMessage {
  extraInfo?: {
    feedback: ActionsFeedbackProps["value"];
  };
}
