import {
  createOpenAiCompatibleSpeechProvider,
  type SpeechProviderPlugin,
} from "openclaw/plugin-sdk/speech-provider";
import {
  DEFAULT_FLEXAI_TTS_VOICE,
  FLEXAI_PROVIDER_ID,
  FLEXAI_SPEECH_MODEL,
  FLEXAI_TTS_RESPONSE_FORMATS,
  FLEXAI_TTS_VOICES,
  normalizeFlexAIModelRef,
} from "./media-models.js";
import { FLEXAI_BASE_URL } from "./provider-catalog.js";

/** Kokoro-82M through `POST /v1/audio/speech`. */
export function buildFlexAISpeechProvider(): SpeechProviderPlugin {
  const provider = createOpenAiCompatibleSpeechProvider({
    id: FLEXAI_PROVIDER_ID,
    label: "FlexAI",
    autoSelectOrder: 45,
    models: [FLEXAI_SPEECH_MODEL],
    voices: [...FLEXAI_TTS_VOICES],
    defaultModel: FLEXAI_SPEECH_MODEL,
    defaultVoice: DEFAULT_FLEXAI_TTS_VOICE,
    defaultBaseUrl: FLEXAI_BASE_URL,
    defaultTimeoutMs: 120_000,
    envKey: "FLEXAI_API_KEY",
    // FlexAI serves wav only; any other response_format is a 400.
    responseFormats: FLEXAI_TTS_RESPONSE_FORMATS,
    defaultResponseFormat: "wav",
    voiceCompatibleResponseFormats: [],
    baseUrlPolicy: { kind: "trim-trailing-slash" },
    normalizeModel: normalizeFlexAIModelRef,
    apiErrorLabel: "FlexAI TTS API error",
    missingApiKeyError: "FlexAI API key missing",
  });
  // The factory only ships the synchronous readiness check, which OpenClaw
  // flags as deprecated; expose the same check on the async hook.
  return {
    ...provider,
    isConfiguredAsync: async (ctx: unknown) => provider.isConfigured(ctx) === true,
  };
}
