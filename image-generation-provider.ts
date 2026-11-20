import {
  createOpenAiCompatibleImageGenerationProvider,
  type ImageGenerationProvider,
} from "openclaw/plugin-sdk/image-generation";
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import {
  DEFAULT_FLEXAI_IMAGE_SIZE,
  FLEXAI_IMAGE_MODEL,
  FLEXAI_IMAGE_SIZES,
  FLEXAI_PROVIDER_ID,
  normalizeFlexAIBaseUrl,
  normalizeFlexAIModelRef,
} from "./media-models.js";
import { FLEXAI_BASE_URL } from "./provider-catalog.js";

/** FLUX.1-schnell through `POST /v1/images/generations` (text to image, one image per request). */
export function buildFlexAIImageGenerationProvider(): ImageGenerationProvider {
  return createOpenAiCompatibleImageGenerationProvider({
    id: FLEXAI_PROVIDER_ID,
    label: "FlexAI",
    defaultModel: FLEXAI_IMAGE_MODEL,
    models: [FLEXAI_IMAGE_MODEL],
    capabilities: {
      generate: {
        // FlexAI rejects n > 1 on this route.
        maxCount: 1,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      edit: { enabled: false },
      geometry: { sizes: [...FLEXAI_IMAGE_SIZES] },
    },
    defaultBaseUrl: FLEXAI_BASE_URL,
    normalizeModel: normalizeFlexAIModelRef,
    resolveBaseUrl: ({ providerConfig }: { providerConfig?: { baseUrl?: unknown } }) =>
      normalizeFlexAIBaseUrl(providerConfig?.baseUrl),
    // Private-network targets stay blocked unless the operator opts in through
    // `models.providers.flexai.request.allowPrivateNetwork`.
    resolveAllowPrivateNetwork: ({
      providerConfig,
    }: {
      providerConfig?: { request?: { allowPrivateNetwork?: unknown } };
    }) => providerConfig?.request?.allowPrivateNetwork === true,
    useConfiguredRequest: true,
    resolveCount: () => 1,
    buildGenerateRequest: ({ req, model }: { req: { prompt: string; size?: string }; model: string }) => ({
      kind: "json",
      body: {
        model,
        prompt: req.prompt,
        n: 1,
        size: normalizeOptionalString(req.size) ?? DEFAULT_FLEXAI_IMAGE_SIZE,
        response_format: "b64_json",
      },
    }),
    buildEditRequest: () => {
      throw new Error("FlexAI image editing is not supported.");
    },
    response: { defaultMimeType: "image/png", sniffMimeType: true },
    missingApiKeyError: "FlexAI API key missing",
    emptyResponseError: "FlexAI image response did not include generated image data",
    failureLabels: {
      generate: "FlexAI image generation failed",
      edit: "FlexAI image edit failed",
    },
  });
}
