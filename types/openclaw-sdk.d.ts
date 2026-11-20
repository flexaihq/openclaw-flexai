// openclaw@2026.11.6 ships declaration files for only some plugin-sdk subpaths.
// The provider and media subpaths this plugin imports are JavaScript-only, so
// these minimal ambient declarations cover exactly the surface used here.

declare module "openclaw/plugin-sdk/provider-model-shared" {
  export type ModelDefinitionConfig = {
    id: string;
    name: string;
    reasoning?: boolean;
    input: string[];
    contextWindow: number;
    maxTokens: number;
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
    compat?: {
      supportsTools?: boolean;
      supportedReasoningEfforts?: string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  export type ModelProviderConfig = {
    baseUrl: string;
    models: ModelDefinitionConfig[];
    [key: string]: unknown;
  };
  export function buildProviderReplayFamilyHooks(options: {
    family: string;
    dropReasoningFromHistory?: boolean;
  }): Record<string, unknown>;
}

declare module "openclaw/plugin-sdk/provider-catalog-shared" {
  import type { ModelProviderConfig } from "openclaw/plugin-sdk/provider-model-shared";
  export function readConfiguredProviderCatalogEntries(params: {
    config: unknown;
    providerId: string;
  }): unknown;
  export function buildManifestModelProviderConfig(params: {
    providerId: string;
    catalog: unknown;
  }): ModelProviderConfig;
}

declare module "openclaw/plugin-sdk/provider-catalog-live-runtime" {
  import type {
    ModelDefinitionConfig,
    ModelProviderConfig,
  } from "openclaw/plugin-sdk/provider-model-shared";
  export type OpenAICompatibleModelDiscoveryOptions = {
    projectRows?: (
      rows: readonly unknown[],
      fallback: ModelProviderConfig,
    ) => ModelDefinitionConfig[];
    [key: string]: unknown;
  };
}

declare module "openclaw/plugin-sdk/provider-entry" {
  export function defineSingleProviderPluginEntry(options: {
    id: string;
    name: string;
    description: string;
    manifest: unknown;
    provider: Record<string, any>;
    register?: (api: any) => void;
  }): unknown;
}

declare module "openclaw/plugin-sdk/provider-tools" {
  export function buildProviderToolCompatFamilyHooks(family: string): Record<string, unknown>;
}

declare module "openclaw/plugin-sdk/model-catalog-pricing" {
  export function normalizeOpenRouterModelPricing(
    pricing: unknown,
  ): { input: number; output: number; cacheRead: number; cacheWrite: number } | undefined;
}

declare module "openclaw/plugin-sdk/image-generation" {
  export type ImageGenerationProvider = Record<string, any>;
  export function createOpenAiCompatibleImageGenerationProvider(
    options: Record<string, any>,
  ): ImageGenerationProvider;
}

declare module "openclaw/plugin-sdk/speech-provider" {
  export type SpeechProviderPlugin = Record<string, any>;
  export function createOpenAiCompatibleSpeechProvider(
    options: Record<string, any>,
  ): SpeechProviderPlugin;
}

declare module "openclaw/plugin-sdk/embedding-providers" {
  export type EmbeddingProviderAdapter = Record<string, any>;
}

declare module "openclaw/plugin-sdk/memory-core-host-engine-embeddings" {
  export function resolveRemoteEmbeddingClient(options: Record<string, any>): Promise<any>;
  export function createRemoteEmbeddingProvider(options: Record<string, any>): any;
  export function embeddingProviderOwnsDestination(options: {
    baseUrl: string;
    providerBaseUrl: string;
  }): boolean;
  export function sanitizeEmbeddingCacheHeaders(
    headers: unknown,
    excluded: readonly string[],
  ): unknown[];
}

declare module "openclaw/plugin-sdk/video-generation" {
  export type VideoGenerationProvider = Record<string, any>;
}

declare module "openclaw/plugin-sdk/media-generation-runtime" {
  export function resolveGeneratedMediaMaxBytes(cfg: unknown, kind: "video" | "image"): number;
}

declare module "openclaw/plugin-sdk/provider-http" {
  export function postJsonResponse<T = unknown>(options: Record<string, any>): Promise<T>;
  export function pollProviderOperationJson<T = unknown>(options: Record<string, any>): Promise<T>;
  export function resolveProviderApiKeyHttpRequestConfig(options: Record<string, any>): Promise<{
    baseUrl: string;
    allowPrivateNetwork?: boolean;
    headers: Headers;
    dispatcherPolicy?: unknown;
  }>;
  export function createProviderOperationDeadline(options: Record<string, any>): unknown;
  export function resolveProviderOperationTimeoutMs(options: Record<string, any>): number;
  export function sanitizeConfiguredModelProviderRequest(request: unknown): unknown;
  export function resolveProviderHttpRequestConfig(options: Record<string, any>): {
    baseUrl: string;
    allowPrivateNetwork?: boolean;
    headers: Headers;
    dispatcherPolicy?: unknown;
  };
  export function buildAudioTranscriptionFormData(options: Record<string, any>): FormData;
  export function postMultipartRequest(
    options: Record<string, any>,
  ): Promise<{ response: Response; release: () => Promise<void> }>;
  export function assertOkOrThrowHttpError(
    response: Response,
    label: string,
    options?: Record<string, any>,
  ): Promise<void>;
  export function readProviderJsonObjectResponse(
    response: Response,
    label: string,
    options?: Record<string, any>,
  ): Promise<Record<string, unknown>>;
  export function requireTranscriptionText(value: unknown, message: string): string;
}
