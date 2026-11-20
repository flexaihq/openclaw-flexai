import type { EmbeddingProviderAdapter } from "openclaw/plugin-sdk/embedding-providers";
import {
  createRemoteEmbeddingProvider,
  embeddingProviderOwnsDestination,
  resolveRemoteEmbeddingClient,
  sanitizeEmbeddingCacheHeaders,
} from "openclaw/plugin-sdk/memory-core-host-engine-embeddings";
import {
  FLEXAI_EMBEDDING_MODEL,
  FLEXAI_PROVIDER_ID,
  normalizeFlexAIModelRef,
} from "./media-models.js";
import { FLEXAI_BASE_URL } from "./provider-catalog.js";

const EXCLUDED_EMBEDDING_HEADERS = ["authorization", "content-type", "x-api-key", "api-key"];

/** bge-m3 (1024 dimensions, 8K context) through `POST /v1/embeddings`. */
export const flexaiEmbeddingProviderAdapter: EmbeddingProviderAdapter = {
  id: FLEXAI_PROVIDER_ID,
  defaultModel: FLEXAI_EMBEDDING_MODEL,
  transport: "remote",
  authProviderId: FLEXAI_PROVIDER_ID,
  normalizeModel: ({ model }: { model?: string }) =>
    normalizeFlexAIModelRef(model, FLEXAI_EMBEDDING_MODEL),
  create: async (createOptions: Record<string, any>) => {
    const client = await resolveRemoteEmbeddingClient({
      provider: FLEXAI_PROVIDER_ID,
      options: {
        ...createOptions,
        provider: FLEXAI_PROVIDER_ID,
        model: normalizeFlexAIModelRef(createOptions.model, FLEXAI_EMBEDDING_MODEL),
      },
      defaultBaseUrl: FLEXAI_BASE_URL,
      normalizeModel: (model: string) => normalizeFlexAIModelRef(model, FLEXAI_EMBEDDING_MODEL),
    });
    const provider = createRemoteEmbeddingProvider({
      id: FLEXAI_PROVIDER_ID,
      client,
      errorPrefix: "FlexAI embeddings API error",
      // Query and document requests are identical, so arrays stay one batch.
      batchQueryInputs: true,
    });
    const headers = sanitizeEmbeddingCacheHeaders(client.headers, EXCLUDED_EMBEDDING_HEADERS);
    const usesDefaultIdentity =
      headers.length === 0 &&
      embeddingProviderOwnsDestination({
        baseUrl: client.baseUrl,
        providerBaseUrl: FLEXAI_BASE_URL,
      });
    return {
      provider,
      runtime: {
        id: FLEXAI_PROVIDER_ID,
        cacheKeyData: {
          provider: FLEXAI_PROVIDER_ID,
          model: client.model,
          ...(usesDefaultIdentity ? {} : { baseUrl: client.baseUrl, headers }),
        },
      },
    };
  },
};
