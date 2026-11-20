import { resolveGeneratedMediaMaxBytes } from "openclaw/plugin-sdk/media-generation-runtime";
import { isProviderApiKeyConfiguredAsync } from "openclaw/plugin-sdk/provider-auth";
import {
  createProviderOperationDeadline,
  pollProviderOperationJson,
  postJsonResponse,
  resolveProviderApiKeyHttpRequestConfig,
  resolveProviderOperationTimeoutMs,
  sanitizeConfiguredModelProviderRequest,
} from "openclaw/plugin-sdk/provider-http";
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import type { VideoGenerationProvider } from "openclaw/plugin-sdk/video-generation";
import {
  FLEXAI_PROVIDER_ID,
  FLEXAI_VIDEO_MODEL,
  FLEXAI_VIDEO_SIZES,
  normalizeFlexAIBaseUrl,
  normalizeFlexAIModelRef,
} from "./media-models.js";
import { FLEXAI_BASE_URL } from "./provider-catalog.js";

// Per-request budget; the whole operation is bounded by `req.timeoutMs`.
const DEFAULT_HTTP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120;
const DEFAULT_OPERATION_TIMEOUT_MS = 600_000;

// `POST /v1/videos/generations` answers 202 with a job id and the job is read
// with `GET /v1/videos/generations/{id}`. A completed job carries the clip
// inline as base64 `data[].b64_json`, and FlexAI hands each completed clip out
// once: a later read of the same job answers 410 `job_already_retrieved`.
export type FlexAIVideoJob = {
  id?: string;
  status?: string;
  model?: string | null;
  data?: Array<{ b64_json?: unknown } | null> | null;
  error?: { code?: unknown; message?: unknown } | string | null;
};

function describeJobError(error: FlexAIVideoJob["error"]): string {
  if (typeof error === "string") return error;
  return normalizeOptionalString(error?.message) ?? "FlexAI video generation failed";
}

export function isFlexAIVideoJobComplete(job: FlexAIVideoJob): boolean {
  if (job.status === "failed") {
    throw new Error(describeJobError(job.error));
  }
  return job.status === "completed";
}

export function parseVideoSize(size: string | undefined): { width: number; height: number } | undefined {
  const match = /^(\d{2,4})x(\d{2,4})$/u.exec(normalizeOptionalString(size) ?? "");
  return match ? { width: Number(match[1]), height: Number(match[2]) } : undefined;
}

export function buildFlexAIVideoRequestBody(req: {
  prompt: string;
  size?: string;
}, model: string): Record<string, unknown> {
  const body: Record<string, unknown> = { model, prompt: req.prompt };
  const size = parseVideoSize(req.size);
  if (size) {
    body.width = size.width;
    body.height = size.height;
  }
  return body;
}

export function extractFlexAIVideoBuffer(job: FlexAIVideoJob, maxBytes: number): Buffer {
  let encoded: string | undefined;
  for (const entry of job.data ?? []) {
    encoded = entry ? normalizeOptionalString(entry.b64_json) : undefined;
    if (encoded) break;
  }
  if (!encoded) {
    throw new Error("FlexAI video response missing video data");
  }
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.byteLength === 0) {
    throw new Error("FlexAI video response contained empty video data");
  }
  if (buffer.byteLength > maxBytes) {
    throw new Error(`FlexAI generated video exceeds ${maxBytes} bytes`);
  }
  return buffer;
}

/** MiniMax-H3 text-to-video through FlexAI's asynchronous video job route. */
export function buildFlexAIVideoGenerationProvider(): VideoGenerationProvider {
  return {
    id: FLEXAI_PROVIDER_ID,
    label: "FlexAI",
    defaultModel: FLEXAI_VIDEO_MODEL,
    defaultTimeoutMs: DEFAULT_OPERATION_TIMEOUT_MS,
    models: [FLEXAI_VIDEO_MODEL],
    isConfiguredAsync: (ctx: Record<string, unknown>) =>
      isProviderApiKeyConfiguredAsync({ provider: FLEXAI_PROVIDER_ID, ...ctx }),
    capabilities: {
      generate: {
        maxVideos: 1,
        supportsSize: true,
        sizes: [...FLEXAI_VIDEO_SIZES],
      },
      imageToVideo: { enabled: false },
      videoToVideo: { enabled: false },
    },
    async generateVideo(req: Record<string, any>) {
      if ((req.inputImages?.length ?? 0) > 0) {
        throw new Error("FlexAI video generation currently supports text-to-video only.");
      }
      if ((req.inputVideos?.length ?? 0) > 0) {
        throw new Error("FlexAI video generation does not support video reference inputs.");
      }
      const model = normalizeFlexAIModelRef(req.model, FLEXAI_VIDEO_MODEL);
      const providerConfig = req.cfg?.models?.providers?.[FLEXAI_PROVIDER_ID];
      const { baseUrl, allowPrivateNetwork, headers, dispatcherPolicy } =
        await resolveProviderApiKeyHttpRequestConfig({
          req,
          missingApiKeyMessage: "FlexAI API key missing",
          baseUrl: normalizeFlexAIBaseUrl(providerConfig?.baseUrl),
          defaultBaseUrl: FLEXAI_BASE_URL,
          provider: FLEXAI_PROVIDER_ID,
          capability: "video",
          request: sanitizeConfiguredModelProviderRequest(providerConfig?.request),
        });
      const deadline = createProviderOperationDeadline({
        timeoutMs: req.timeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS,
        label: "FlexAI video generation",
      });

      const submitted = await postJsonResponse<FlexAIVideoJob>({
        url: `${baseUrl}/videos/generations`,
        headers,
        body: buildFlexAIVideoRequestBody(req as { prompt: string; size?: string }, model),
        timeoutMs: resolveProviderOperationTimeoutMs({
          deadline,
          defaultTimeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
        }),
        fetchFn: fetch,
        allowPrivateNetwork,
        dispatcherPolicy,
        errorLabel: "FlexAI video generation failed",
      });
      const jobId = normalizeOptionalString(submitted.id);
      if (!jobId) {
        throw new Error("FlexAI video generation response missing job id");
      }
      const completed = isFlexAIVideoJobComplete(submitted)
        ? submitted
        : await pollProviderOperationJson<FlexAIVideoJob>({
            url: `${baseUrl}/videos/generations/${encodeURIComponent(jobId)}`,
            headers,
            deadline,
            defaultTimeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
            fetchFn: fetch,
            maxAttempts: MAX_POLL_ATTEMPTS,
            pollIntervalMs: POLL_INTERVAL_MS,
            requestFailedMessage: "FlexAI video status request failed",
            timeoutMessage: `FlexAI video generation job ${jobId} did not finish in time`,
            allowPrivateNetwork,
            dispatcherPolicy,
            auditContext: "flexai-video-status",
            isComplete: isFlexAIVideoJobComplete,
          });
      const buffer = extractFlexAIVideoBuffer(completed, resolveGeneratedMediaMaxBytes(req.cfg, "video"));
      return {
        videos: [{ buffer, mimeType: "video/mp4", fileName: "video-1.mp4" }],
        model: normalizeOptionalString(completed.model) ?? model,
        metadata: { jobId, status: completed.status },
      };
    },
  };
}
