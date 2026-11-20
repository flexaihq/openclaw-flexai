import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import { FLEXAI_BASE_URL } from "./provider-catalog.js";

export const FLEXAI_PROVIDER_ID = "flexai";

// Non-chat model ids exactly as `GET /v1/models` reports them. FlexAI resolves
// only the canonical id (plus declared aliases), so these are never rewritten.
export const FLEXAI_IMAGE_MODEL = "FLUX.1-schnell";
export const FLEXAI_SPEECH_MODEL = "Kokoro-82M";
export const FLEXAI_TRANSCRIPTION_MODELS = [
  "whisper-large-v3-turbo",
  "parakeet-tdt-0.6b-v3",
] as const;
export const FLEXAI_EMBEDDING_MODEL = "bge-m3";
export const FLEXAI_VIDEO_MODEL = "MiniMax-H3";
/** Fastest of the vision chat rows that read an image back correctly. */
export const FLEXAI_IMAGE_UNDERSTANDING_MODEL = "gemma-4-26B-A4B-it";

export const DEFAULT_FLEXAI_IMAGE_SIZE = "1024x1024";
// FlexAI accepts any WxH with each side in [64, 2048]; these are the sizes
// offered to agents.
export const FLEXAI_IMAGE_SIZES = [
  "512x512",
  "768x768",
  "1024x1024",
  "1024x768",
  "768x1024",
] as const;

// FlexAI serves Kokoro voices plus the OpenAI voice aliases. `wav` is the only
// response format served today.
export const DEFAULT_FLEXAI_TTS_VOICE = "af_heart";
export const FLEXAI_TTS_VOICES = [
  "af_heart",
  "af_bella",
  "af_sky",
  "am_adam",
  "am_michael",
  "alloy",
  "echo",
  "fable",
  "nova",
  "onyx",
  "shimmer",
] as const;
export const FLEXAI_TTS_RESPONSE_FORMATS = ["wav"] as const;

export const FLEXAI_VIDEO_SIZES = ["768x768"] as const;

export function normalizeFlexAIModelRef(model: string | undefined, fallback: string): string {
  const value = normalizeOptionalString(model) ?? fallback;
  return value.startsWith("flexai/") ? value.slice("flexai/".length) : value;
}

export function normalizeFlexAIBaseUrl(value: unknown, fallback = FLEXAI_BASE_URL): string {
  return (normalizeOptionalString(value) ?? fallback).replace(/\/+$/u, "");
}
