import type {
  SSEFields,
  XModelParams,
  XModelResponse,
} from "@ant-design/x-sdk";
import { OpenAIChatProvider, XRequest } from "@ant-design/x-sdk";

const providerCaches = new Map<string, OpenAIChatProvider>();

export const providerFactory = (conversationKey: string) => {
  if (!providerCaches.get(conversationKey)) {
    providerCaches.set(
      conversationKey,
      new OpenAIChatProvider({
        request: XRequest<
          XModelParams & { conversationId?: string },
          Partial<Record<SSEFields, XModelResponse>>
        >("/api/chat", {
          manual: true,
          params: {
            stream: true,
            conversationId: conversationKey,
          },
        }),
      }),
    );
  }

  return providerCaches.get(conversationKey);
};
