// openclaw@2026.11.6 ships declaration files for only some plugin-sdk subpaths.
// The provider subpaths this plugin imports are JavaScript-only, so these
// minimal ambient declarations cover exactly the surface used here.

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
