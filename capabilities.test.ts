// Capability tests: registration, request shape and response mapping for the
// non-chat surfaces. Requests go to a real loopback HTTP server, not a mocked
// transport; the live proof against FlexAI itself is run through OpenClaw.
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import plugin from "./index.js";
import manifest from "./openclaw.plugin.json" with { type: "json" };
import { FLEXAI_MODEL_DISCOVERY, buildFlexAIProvider } from "./api.js";
import {
  buildFlexAIVideoRequestBody,
  extractFlexAIVideoBuffer,
  isFlexAIVideoJobComplete,
  parseVideoSize,
} from "./video-generation-provider.js";

type Recorded = { method: string; url: string; headers: Record<string, string>; body: Buffer };

let server: Server;
let baseUrl: string;
let recorded: Recorded[] = [];
let handler: (req: Recorded) => { status?: number; type?: string; body: string | Buffer };

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const entry: Recorded = {
      method: req.method ?? "GET",
      url: req.url ?? "",
      headers: req.headers as Record<string, string>,
      body: await readBody(req),
    };
    recorded.push(entry);
    const reply = handler(entry);
    res.writeHead(reply.status ?? 200, { "content-type": reply.type ?? "application/json" });
    res.end(reply.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  recorded = [];
  handler = () => ({ status: 500, body: "{}" });
});

function cfg() {
  return {
    models: {
      providers: {
        flexai: {
          baseUrl,
          apiKey: "unit-test-key",
          request: { allowPrivateNetwork: true },
        },
      },
    },
  };
}

async function registerAll() {
  const registered: Record<string, any[]> = {};
  const api = new Proxy(
    {
      id: "flexai",
      config: {},
      pluginConfig: {},
      runtime: {},
      registrationMode: "full",
      logger: { debug() {}, info() {}, warn() {}, error() {} },
    } as Record<string, unknown>,
    {
      get(target, key) {
        if (typeof key === "string" && key in target) return target[key];
        return (value: unknown) => {
          (registered[String(key)] ??= []).push(value);
        };
      },
    },
  );
  (plugin as { register: (api: never) => void }).register(api as never);
  return registered;
}

describe("flexai media registration", () => {
  it("registers every capability the manifest contracts declare", async () => {
    const registered = await registerAll();
    const contracts = manifest.contracts;
    expect(registered.registerImageGenerationProvider?.[0]?.id).toBe("flexai");
    expect(registered.registerSpeechProvider?.[0]?.id).toBe("flexai");
    expect(registered.registerMediaUnderstandingProvider?.[0]?.id).toBe("flexai");
    expect(registered.registerEmbeddingProvider?.[0]?.id).toBe("flexai");
    expect(registered.registerVideoGenerationProvider?.[0]?.id).toBe("flexai");
    expect(contracts).toEqual({
      mediaUnderstandingProviders: ["flexai"],
      embeddingProviders: ["flexai"],
      imageGenerationProviders: ["flexai"],
      speechProviders: ["flexai"],
      videoGenerationProviders: ["flexai"],
    });
  });

  it("declares the media-understanding defaults in the manifest the same as at runtime", async () => {
    const registered = await registerAll();
    const provider = registered.registerMediaUnderstandingProvider![0];
    expect(manifest.mediaUnderstandingProviderMetadata.flexai).toEqual({
      capabilities: provider.capabilities,
      defaultModels: provider.defaultModels,
      autoPriority: provider.autoPriority,
    });
  });
});

describe("flexai image generation (FLUX.1-schnell)", () => {
  it("posts one b64_json image request and maps the response", async () => {
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6b6ef0000000049454e44ae426082",
      "hex",
    );
    handler = () => ({ body: JSON.stringify({ created: 1, data: [{ b64_json: png.toString("base64") }] }) });
    const [provider] = (await registerAll()).registerImageGenerationProvider!;

    const result = await provider.generateImage({
      provider: "flexai",
      model: "flexai/FLUX.1-schnell",
      prompt: "a red apple",
      cfg: cfg(),
      count: 3,
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.url).toBe("/v1/images/generations");
    expect(recorded[0]!.headers.authorization).toBe("Bearer unit-test-key");
    expect(JSON.parse(recorded[0]!.body.toString())).toEqual({
      model: "FLUX.1-schnell",
      prompt: "a red apple",
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });
    expect(result.model).toBe("FLUX.1-schnell");
    expect(result.images).toHaveLength(1);
    expect(result.images[0].mimeType).toBe("image/png");
    expect(Buffer.compare(result.images[0].buffer, png)).toBe(0);
  });

  it("passes a requested size through and refuses editing", async () => {
    handler = () => ({ body: JSON.stringify({ data: [{ b64_json: Buffer.from("x").toString("base64") }] }) });
    const [provider] = (await registerAll()).registerImageGenerationProvider!;
    await provider.generateImage({ provider: "flexai", model: "FLUX.1-schnell", prompt: "p", cfg: cfg(), size: "512x512" });
    expect(JSON.parse(recorded[0]!.body.toString()).size).toBe("512x512");
    expect(provider.capabilities.edit.enabled).toBe(false);
    expect(provider.capabilities.generate.maxCount).toBe(1);
    await expect(
      provider.generateImage({
        provider: "flexai",
        model: "FLUX.1-schnell",
        prompt: "p",
        cfg: cfg(),
        inputImages: [{ buffer: Buffer.from("x"), mimeType: "image/png" }],
      }),
    ).rejects.toThrow(/editing is not supported/);
  });

  it("surfaces a FlexAI error response", async () => {
    handler = () => ({ status: 422, body: JSON.stringify({ error: { message: "bad size" } }) });
    const [provider] = (await registerAll()).registerImageGenerationProvider!;
    await expect(
      provider.generateImage({ provider: "flexai", model: "FLUX.1-schnell", prompt: "p", cfg: cfg() }),
    ).rejects.toThrow(/FlexAI image generation failed/);
  });
});

describe("flexai speech (Kokoro-82M)", () => {
  it("declares the wav-only Kokoro surface", async () => {
    const [provider] = (await registerAll()).registerSpeechProvider!;
    expect(provider.models).toEqual(["Kokoro-82M"]);
    expect(provider.defaultModel).toBe("Kokoro-82M");
    expect(provider.voices).toContain("af_heart");
    expect(provider.voices).toContain("alloy");
    const config = provider.resolveConfig({ rawConfig: {} });
    expect(config).toMatchObject({ model: "Kokoro-82M", voice: "af_heart" });
    expect(config.baseUrl).toBeUndefined();
  });

  it("rejects a response format FlexAI does not serve", async () => {
    const [provider] = (await registerAll()).registerSpeechProvider!;
    expect(() =>
      provider.resolveConfig({ rawConfig: { providers: { flexai: { responseFormat: "mp3" } } } }),
    ).toThrow(/Invalid FlexAI speech responseFormat/);
    expect(
      provider.resolveConfig({ rawConfig: { providers: { flexai: { responseFormat: "wav" } } } }).responseFormat,
    ).toBe("wav");
  });

  it("is configured from a key in provider config", async () => {
    const [provider] = (await registerAll()).registerSpeechProvider!;
    expect(provider.isConfigured({ cfg: {}, providerConfig: { apiKey: "k" } })).toBe(true);
    await expect(
      provider.isConfiguredAsync({ cfg: {}, providerConfig: { apiKey: "k" } }),
    ).resolves.toBe(true);
  });
});

describe("flexai transcription (whisper-large-v3-turbo, parakeet-tdt-0.6b-v3)", () => {
  async function transcribe(model: string | undefined) {
    handler = () => ({ body: JSON.stringify({ text: " The password is banana." }) });
    const [provider] = (await registerAll()).registerMediaUnderstandingProvider!;
    const result = await provider.transcribeAudio({
      buffer: Buffer.from("RIFFfake"),
      fileName: "clip.wav",
      mime: "audio/wav",
      apiKey: "unit-test-key",
      baseUrl,
      request: { allowPrivateNetwork: true },
      model,
      timeoutMs: 10_000,
      cfg: cfg(),
    });
    return result;
  }

  it("defaults to whisper-large-v3-turbo on /audio/transcriptions as multipart", async () => {
    const result = await transcribe(undefined);
    expect(result).toEqual({ text: "The password is banana.", model: "whisper-large-v3-turbo" });
    expect(recorded[0]!.url).toBe("/v1/audio/transcriptions");
    expect(recorded[0]!.headers.authorization).toBe("Bearer unit-test-key");
    expect(recorded[0]!.headers["content-type"]).toMatch(/^multipart\/form-data/);
    const body = recorded[0]!.body.toString("latin1");
    expect(body).toContain('name="model"');
    expect(body).toContain("whisper-large-v3-turbo");
    expect(body).toContain('name="file"; filename="clip.wav"');
  });

  it("sends the requested parakeet model", async () => {
    const result = await transcribe("parakeet-tdt-0.6b-v3");
    expect(result.model).toBe("parakeet-tdt-0.6b-v3");
    expect(recorded[0]!.body.toString("latin1")).toContain("parakeet-tdt-0.6b-v3");
  });

  it("registers image understanding backed by a vision chat row", async () => {
    const [provider] = (await registerAll()).registerMediaUnderstandingProvider!;
    expect(provider.capabilities).toEqual(["image", "audio"]);
    const visionRow = buildFlexAIProvider().models.find((m) => m.id === provider.defaultModels.image);
    expect(visionRow?.input).toContain("image");
  });

  it("describes an image with an image_url chat request and returns the text", async () => {
    handler = () => ({
      body: JSON.stringify({ choices: [{ message: { role: "assistant", content: " A word: MANGO " } }] }),
    });
    const [provider] = (await registerAll()).registerMediaUnderstandingProvider!;
    const png = Buffer.from("not-a-real-png");
    const result = await provider.describeImage({
      buffer: png,
      fileName: "word.png",
      mime: "image/png",
      model: "flexai/gemma-4-26B-A4B-it",
      provider: "flexai",
      prompt: "What word is shown?",
      timeoutMs: 10_000,
      agentDir: "/nonexistent",
      cfg: cfg(),
    });

    expect(result).toEqual({ text: "A word: MANGO", model: "gemma-4-26B-A4B-it" });
    expect(recorded[0]!.url).toBe("/v1/chat/completions");
    expect(recorded[0]!.headers.authorization).toBe("Bearer unit-test-key");
    const body = JSON.parse(recorded[0]!.body.toString());
    expect(body.model).toBe("gemma-4-26B-A4B-it");
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content[0]).toEqual({ type: "text", text: "What word is shown?" });
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${png.toString("base64")}` },
    });
  });

  it("refuses an image description with no content", async () => {
    handler = () => ({ body: JSON.stringify({ choices: [{ message: { content: null } }] }) });
    const [provider] = (await registerAll()).registerMediaUnderstandingProvider!;
    await expect(
      provider.describeImage({
        buffer: Buffer.from("x"),
        fileName: "x.png",
        model: "gemma-4-26B-A4B-it",
        provider: "flexai",
        timeoutMs: 10_000,
        agentDir: "/nonexistent",
        cfg: cfg(),
      }),
    ).rejects.toThrow(/missing content/);
  });
});

describe("flexai embeddings (bge-m3)", () => {
  it("is the default model and posts to /embeddings with the model and inputs", async () => {
    handler = () => ({
      body: JSON.stringify({
        model: "bge-m3",
        object: "list",
        data: [
          { object: "embedding", index: 0, embedding: [3, 4] },
          { object: "embedding", index: 1, embedding: [0, 2] },
        ],
        usage: { prompt_tokens: 2, total_tokens: 2 },
      }),
    });
    const [adapter] = (await registerAll()).registerEmbeddingProvider!;
    expect(adapter.defaultModel).toBe("bge-m3");
    expect(adapter.normalizeModel({ model: "flexai/bge-m3" })).toBe("bge-m3");
    expect(adapter.normalizeModel({})).toBe("bge-m3");

    const { provider } = await adapter.create({
      config: cfg(),
      model: "",
      provider: "flexai",
      fallback: "none",
      remote: { baseUrl, apiKey: "unit-test-key" },
    });
    const vectors = await provider.embedBatch(["alpha", "beta"]);

    expect(recorded[0]!.url).toBe("/v1/embeddings");
    expect(recorded[0]!.headers.authorization).toBe("Bearer unit-test-key");
    expect(JSON.parse(recorded[0]!.body.toString())).toMatchObject({
      model: "bge-m3",
      input: ["alpha", "beta"],
    });
    expect(vectors).toHaveLength(2);
    expect(vectors.map((vector) => [...vector])).toEqual([
      [3, 4],
      [0, 2],
    ]);
  });
});

describe("flexai video generation (MiniMax-H3)", () => {
  it("maps size to width and height and omits unsupported fields", () => {
    expect(parseVideoSize("768x768")).toEqual({ width: 768, height: 768 });
    expect(parseVideoSize("wide")).toBeUndefined();
    expect(buildFlexAIVideoRequestBody({ prompt: "p", size: "768x768" }, "MiniMax-H3")).toEqual({
      model: "MiniMax-H3",
      prompt: "p",
      width: 768,
      height: 768,
    });
    expect(buildFlexAIVideoRequestBody({ prompt: "p" }, "MiniMax-H3")).toEqual({
      model: "MiniMax-H3",
      prompt: "p",
    });
  });

  it("reads job state and the inline clip", () => {
    expect(isFlexAIVideoJobComplete({ status: "queued" })).toBe(false);
    expect(isFlexAIVideoJobComplete({ status: "processing" })).toBe(false);
    expect(isFlexAIVideoJobComplete({ status: "completed" })).toBe(true);
    expect(() =>
      isFlexAIVideoJobComplete({ status: "failed", error: { code: "ReadError", message: "Generation failed." } }),
    ).toThrow("Generation failed.");
    const clip = Buffer.from("ftypmp4data");
    expect(
      Buffer.compare(extractFlexAIVideoBuffer({ data: [{ b64_json: clip.toString("base64") }] }, 1024), clip),
    ).toBe(0);
    expect(() => extractFlexAIVideoBuffer({ data: null }, 1024)).toThrow(/missing video data/);
    expect(() => extractFlexAIVideoBuffer({ data: [{ b64_json: clip.toString("base64") }] }, 4)).toThrow(/exceeds/);
  });

  it("submits a job, polls until completed and returns the clip", async () => {
    const clip = Buffer.from("not-really-an-mp4");
    let polls = 0;
    handler = (req) => {
      if (req.method === "POST") {
        return { status: 202, body: JSON.stringify({ id: "vid_1", status: "queued", model: "MiniMax-H3" }) };
      }
      polls += 1;
      return polls < 2
        ? { body: JSON.stringify({ id: "vid_1", status: "processing", data: null }) }
        : { body: JSON.stringify({ id: "vid_1", status: "completed", model: "MiniMax-H3", data: [{ b64_json: clip.toString("base64") }] }) };
    };
    const [provider] = (await registerAll()).registerVideoGenerationProvider!;
    const result = await provider.generateVideo({
      provider: "flexai",
      model: "flexai/MiniMax-H3",
      prompt: "a ball",
      cfg: cfg(),
      size: "768x768",
      timeoutMs: 60_000,
    });

    expect(recorded[0]!.method).toBe("POST");
    expect(recorded[0]!.url).toBe("/v1/videos/generations");
    expect(recorded[0]!.headers.authorization).toBe("Bearer unit-test-key");
    expect(JSON.parse(recorded[0]!.body.toString())).toEqual({
      model: "MiniMax-H3",
      prompt: "a ball",
      width: 768,
      height: 768,
    });
    expect(recorded.slice(1).every((r) => r.method === "GET" && r.url === "/v1/videos/generations/vid_1")).toBe(true);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].mimeType).toBe("video/mp4");
    expect(Buffer.compare(result.videos[0].buffer, clip)).toBe(0);
    expect(result.metadata).toMatchObject({ jobId: "vid_1", status: "completed" });
  }, 30_000);

  it("is text-to-video only", async () => {
    const [provider] = (await registerAll()).registerVideoGenerationProvider!;
    expect(provider.capabilities.imageToVideo.enabled).toBe(false);
    expect(provider.capabilities.videoToVideo.enabled).toBe(false);
    await expect(
      provider.generateVideo({
        provider: "flexai",
        model: "MiniMax-H3",
        prompt: "p",
        cfg: cfg(),
        inputImages: [{ buffer: Buffer.from("x") }],
      }),
    ).rejects.toThrow(/text-to-video only/);
  });
});

describe("flexai vision rows", () => {
  it("seeds PaddleOCR-VL as an image-input chat row without tools", () => {
    const row = buildFlexAIProvider().models.find((model) => model.id === "PaddleOCR-VL");
    expect(row?.input).toEqual(["text", "image"]);
    expect(row?.compat?.supportsTools).toBe(false);
  });

  it("discovers a vision row that takes image input but does not declare chat", () => {
    const project = FLEXAI_MODEL_DISCOVERY.projectRows!;
    const models = project(
      [
        {
          id: "fixture-ocr",
          object: "model",
          supports: ["image_input", "structured_outputs"],
          category: "vision",
          context_length: 131072,
          input_modalities: ["text", "image"],
          output_modalities: ["text"],
        },
        {
          id: "fixture-guard",
          object: "model",
          supports: ["vision", "moderation"],
          category: "moderation",
          context_length: 16384,
          input_modalities: ["text", "image"],
          output_modalities: ["text"],
        },
        {
          id: "fixture-video",
          object: "model",
          supports: ["image_input", "video_generation"],
          category: "video",
          input_modalities: ["text", "image"],
          output_modalities: ["video"],
        },
      ],
      buildFlexAIProvider(),
    );
    expect(models.map((model) => model.id)).toEqual(["fixture-ocr"]);
    expect(models[0]?.input).toEqual(["text", "image"]);
    expect(models[0]?.compat?.supportsTools).toBe(false);
  });
});
