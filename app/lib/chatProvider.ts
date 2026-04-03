import type {
  SSEFields,
  XModelParams,
  XModelResponse,
} from "@ant-design/x-sdk";
import { OpenAIChatProvider, XRequest } from "@ant-design/x-sdk";

const providerCaches = new Map<string, OpenAIChatProvider>();

export const providerFactory = (conversationKey: string) => {
  let provider = providerCaches.get(conversationKey);
  if (provider) return provider;

  provider = new OpenAIChatProvider({
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
  });

  providerCaches.set(conversationKey, provider);
  return provider;
};
