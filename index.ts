import { readConfiguredProviderCatalogEntries } from "openclaw/plugin-sdk/provider-catalog-shared";
import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { buildProviderReplayFamilyHooks } from "openclaw/plugin-sdk/provider-model-shared";
import { buildProviderToolCompatFamilyHooks } from "openclaw/plugin-sdk/provider-tools";
import manifest from "./openclaw.plugin.json" with { type: "json" };
import { flexaiEmbeddingProviderAdapter } from "./embedding-adapter.js";
import { buildFlexAIImageGenerationProvider } from "./image-generation-provider.js";
import { flexaiMediaUnderstandingProvider } from "./media-understanding-provider.js";
import { FLEXAI_MODEL_DISCOVERY } from "./provider-catalog.js";
import { buildFlexAISpeechProvider } from "./speech-provider.js";
import { buildFlexAIVideoGenerationProvider } from "./video-generation-provider.js";

const PROVIDER_ID = "flexai";

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "FlexAI Provider",
  description: "FlexAI provider plugin",
  manifest,
  provider: {
    label: "FlexAI",
    docsPath: "/providers/flexai",
    manifestAuth: {
      noteTitle: "FlexAI",
      noteMessage: [
        "FlexAI serves open-weight models behind an OpenAI-compatible API.",
        "Create an API key at: https://flex.ai",
      ].join("\n"),
    },
    catalog: {
      discoveryMode: "strict",
      allowExplicitBaseUrl: true,
      liveModelDiscovery: FLEXAI_MODEL_DISCOVERY,
    },
    augmentModelCatalog: ({ config }: { config: unknown }) =>
      readConfiguredProviderCatalogEntries({
        config,
        providerId: PROVIDER_ID,
      }),
    ...buildProviderReplayFamilyHooks({
      family: "openai-compatible",
      dropReasoningFromHistory: false,
    }),
    ...buildProviderToolCompatFamilyHooks("openai"),
  },
  register(api: any) {
    // Registration stays offline: every capability resolves its credential and
    // endpoint at call time.
    api.registerImageGenerationProvider(buildFlexAIImageGenerationProvider());
    api.registerSpeechProvider(buildFlexAISpeechProvider());
    api.registerMediaUnderstandingProvider(flexaiMediaUnderstandingProvider);
    api.registerEmbeddingProvider(flexaiEmbeddingProviderAdapter);
    api.registerVideoGenerationProvider(buildFlexAIVideoGenerationProvider());
  },
});
