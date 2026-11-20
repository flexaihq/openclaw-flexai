import type { MediaUnderstandingProvider } from "openclaw/plugin-sdk/media-understanding";
import {
  assertOkOrThrowHttpError,
  buildAudioTranscriptionFormData,
  postJsonResponse,
  postMultipartRequest,
  readProviderJsonObjectResponse,
  requireTranscriptionText,
  resolveProviderApiKeyHttpRequestConfig,
  resolveProviderHttpRequestConfig,
  sanitizeConfiguredModelProviderRequest,
} from "openclaw/plugin-sdk/provider-http";
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import {
  FLEXAI_IMAGE_UNDERSTANDING_MODEL,
  FLEXAI_PROVIDER_ID,
  FLEXAI_TRANSCRIPTION_MODELS,
  normalizeFlexAIBaseUrl,
  normalizeFlexAIModelRef,
} from "./media-models.js";
import { FLEXAI_BASE_URL } from "./provider-catalog.js";

const DEFAULT_IMAGE_PROMPT = "Describe the image.";
const DEFAULT_IMAGE_MAX_TOKENS = 1024;

type ImageInput = { buffer: Buffer; fileName: string; mime?: string };

/**
 * Batch audio through `POST /v1/audio/transcriptions` (multipart `file` and
 * `model`). whisper-large-v3-turbo is the default; select parakeet-tdt-0.6b-v3
 * with a model override.
 */
async function transcribeAudio(req: Record<string, any>) {
  const { baseUrl, allowPrivateNetwork, headers, dispatcherPolicy } =
    resolveProviderHttpRequestConfig({
      baseUrl: req.baseUrl,
      defaultBaseUrl: FLEXAI_BASE_URL,
      headers: req.headers,
      request: req.request,
      defaultHeaders: req.apiKey ? { authorization: `Bearer ${req.apiKey}` } : undefined,
      provider: FLEXAI_PROVIDER_ID,
      capability: "audio",
      transport: "media-understanding",
    });
  const model = normalizeFlexAIModelRef(req.model, FLEXAI_TRANSCRIPTION_MODELS[0]);
  const form = buildAudioTranscriptionFormData({
    buffer: req.buffer,
    fileName: req.fileName,
    mime: req.mime,
    fields: { model, language: req.language, prompt: req.prompt },
  });
  const { response, release } = await postMultipartRequest({
    url: `${baseUrl}/audio/transcriptions`,
    headers,
    body: form,
    timeoutMs: req.timeoutMs,
    ...(req.signal ? { signal: req.signal } : {}),
    fetchFn: req.fetchFn ?? fetch,
    pinDns: false,
    allowPrivateNetwork,
    dispatcherPolicy,
  });
  try {
    await assertOkOrThrowHttpError(response, "FlexAI audio transcription failed", {
      requestHeaders: headers,
    });
    const payload = await readProviderJsonObjectResponse(
      response,
      "FlexAI audio transcription failed",
      { requestHeaders: headers },
    );
    return {
      text: requireTranscriptionText(payload.text, "FlexAI audio transcription response missing text"),
      model,
    };
  } finally {
    await release();
  }
}

export function buildFlexAIImageChatBody(params: {
  model: string;
  prompt?: string;
  images: readonly ImageInput[];
  maxTokens?: number;
}): Record<string, unknown> {
  return {
    model: params.model,
    max_tokens: params.maxTokens ?? DEFAULT_IMAGE_MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: normalizeOptionalString(params.prompt) ?? DEFAULT_IMAGE_PROMPT },
          ...params.images.map((image) => ({
            type: "image_url",
            image_url: {
              url: `data:${normalizeOptionalString(image.mime) ?? "image/png"};base64,${image.buffer.toString("base64")}`,
            },
          })),
        ],
      },
    ],
  };
}

export function readFlexAIChatText(payload: unknown): string | undefined {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> } | undefined)
    ?.choices?.[0]?.message?.content;
  if (typeof content === "string") return normalizeOptionalString(content);
  if (Array.isArray(content)) {
    return normalizeOptionalString(
      content
        .map((part) => (typeof (part as { text?: unknown })?.text === "string" ? (part as { text: string }).text : ""))
        .join(""),
    );
  }
  return undefined;
}

/**
 * Image understanding through a FlexAI vision chat row on
 * `POST /v1/chat/completions` with `image_url` content parts.
 */
async function describeImages(req: Record<string, any>) {
  const model = normalizeFlexAIModelRef(req.model, FLEXAI_IMAGE_UNDERSTANDING_MODEL);
  const providerConfig = req.cfg?.models?.providers?.[FLEXAI_PROVIDER_ID];
  const { baseUrl, allowPrivateNetwork, headers, dispatcherPolicy } =
    await resolveProviderApiKeyHttpRequestConfig({
      req,
      missingApiKeyMessage: "FlexAI API key missing",
      baseUrl: normalizeFlexAIBaseUrl(providerConfig?.baseUrl),
      defaultBaseUrl: FLEXAI_BASE_URL,
      provider: FLEXAI_PROVIDER_ID,
      capability: "image",
      request: sanitizeConfiguredModelProviderRequest(providerConfig?.request),
    });
  const payload = await postJsonResponse<unknown>({
    url: `${baseUrl}/chat/completions`,
    headers,
    body: buildFlexAIImageChatBody({
      model,
      prompt: req.prompt,
      images: req.images,
      maxTokens: req.maxTokens,
    }),
    timeoutMs: req.timeoutMs,
    ...(req.signal ? { signal: req.signal } : {}),
    fetchFn: fetch,
    allowPrivateNetwork,
    dispatcherPolicy,
    errorLabel: "FlexAI image description failed",
  });
  const text = readFlexAIChatText(payload);
  if (!text) {
    throw new Error("FlexAI image description response missing content");
  }
  return { text, model };
}

export const flexaiMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: FLEXAI_PROVIDER_ID,
  capabilities: ["image", "audio"],
  defaultModels: {
    image: FLEXAI_IMAGE_UNDERSTANDING_MODEL,
    audio: FLEXAI_TRANSCRIPTION_MODELS[0],
  },
  autoPriority: {
    image: 45,
    audio: 45,
  },
  transcribeAudio: transcribeAudio as MediaUnderstandingProvider["transcribeAudio"],
  describeImage: ((req: Record<string, any>) =>
    describeImages({ ...req, images: [req] })) as MediaUnderstandingProvider["describeImage"],
  describeImages: describeImages as MediaUnderstandingProvider["describeImages"],
};
