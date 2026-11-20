# FlexAI provider

[FlexAI](https://flex.ai) serves open-weight models through an OpenAI-compatible API. The plugin discovers the live chat catalog and its prices, with a bundled catalog for offline fallback, and also registers FlexAI's image generation, speech, transcription, image understanding, embedding and video generation models. See [Beyond chat](#beyond-chat).

| Property        | Value                                        |
| --------------- | -------------------------------------------- |
| Provider id     | `flexai`                                     |
| Plugin          | `@flexai/openclaw-provider` (ClawHub)        |
| Auth env var    | `FLEXAI_API_KEY`                             |
| Onboarding flag | `--auth-choice flexai-api-key`               |
| Direct CLI flag | `--flexai-api-key <key>`                     |
| API             | OpenAI-compatible (`openai-completions`)     |
| Base URL        | `https://api.flex.ai/v1`                     |

## Install plugin

```bash
openclaw plugins install @flexai/openclaw-provider
```

Installation applies to a running Gateway automatically; otherwise it takes effect
on the next startup. Requires OpenClaw 2026.11.6 or newer.

## Getting started

1. Create an API key from the [FlexAI docs](https://docs.flex.ai).
2. Save the key, using any one of these:

   ```bash
   # Interactive onboarding
   openclaw onboard --auth-choice flexai-api-key

   # Paste the key into an auth profile
   openclaw models auth paste-api-key --provider flexai

   # Direct flag
   openclaw onboard --non-interactive --accept-risk --skip-health \
     --auth-choice flexai-api-key \
     --flexai-api-key "$FLEXAI_API_KEY"

   # Environment only
   export FLEXAI_API_KEY=...
   ```

3. Verify models are available:

   ```bash
   openclaw models list --provider flexai
   ```

   If `FLEXAI_API_KEY` is unresolved, `openclaw models status --json` reports the missing credential under `auth.unusableProfiles`.

## Non-interactive setup

```bash
openclaw onboard --non-interactive --accept-risk --skip-health \
  --mode local \
  --auth-choice flexai-api-key \
  --flexai-api-key "$FLEXAI_API_KEY"
```

`--mode` defaults to `local`. Run it on the Gateway host: remote-client onboarding
(`--mode remote`) only configures the local client connection and does not set
up provider credentials on the server.

## Model ids

Use the id `GET /v1/models` reports, such as `flexai/DeepSeek-V4-Flash-0731`.
FlexAI also resolves a row's declared lowercase alias and its Hugging Face
`org/name` form, but an unrecognized prefix, an unknown name, or the wrong case
returns `404` with a message pointing back at the canonical id. The bundled
catalog and discovery both use the canonical id, so configured model refs keep
working when an alias changes.

## Discovery and pricing

When FlexAI auth is configured, OpenClaw reads `GET /v1/models` through the
configured base URL and projects the chat-capable rows into the catalog, plus
`PaddleOCR-VL`, a vision row that takes image input and answers in text without
declaring `chat`. The same endpoint also lists embedding, transcription, speech,
image-generation, video-generation, reranking and moderation models; those are
not selectable as chat models and are filtered out of the chat catalog. The
embedding, speech, transcription, image-generation and video-generation models
are served through their own OpenClaw capabilities (see
[Beyond chat](#beyond-chat)). Reranking and moderation models are not exposed.

Live rows supply the context window, prompt/completion/cached-prompt prices, and
image-input support. FlexAI returns prices as USD per-token strings alongside
per-million fields; the plugin reads the per-token form and converts to USD per
million tokens. FlexAI publishes no cache-write tariff, so that rate stays zero;
a zero rate in OpenClaw's estimate is not a claim about FlexAI's billing.

Rows carry an `is_ready` flag that is not a reliable availability signal (it
reads `false` for models that serve requests normally), so discovery does not
filter on it.

Successful catalogs are cached for 60 seconds. If discovery fails, returns an
empty catalog, or has no usable model rows, OpenClaw uses the bundled offline
catalog. In the default `models.mode: "merge"`, onboarding does not copy
generated model rows or prices into your config, allowing prices to refresh.
Explicitly authored model rows and costs remain intact. In
`models.mode: "replace"`, discovery is disabled and onboarding keeps the offline
catalog as explicit config instead.

### Output limits

FlexAI reports `max_output_length` equal to `context_length` on every row, so it
is not an independent output budget: prompt and completion share the context
window. The catalog therefore publishes the context window as `maxTokens` rather
than inventing a ceiling the API does not impose.

## Bundled catalog

24 offline fallback chat models. Context windows, prices, tool support, reasoning
and image-input flags come from the FlexAI `GET /v1/models` listing. Prices are
USD per million tokens; the listing is the source of truth and live discovery
refreshes them.

| Model ref | Context | Reasoning | Image input | Price in / out (USD per 1M tokens) | Notes |
| --- | --- | --- | --- | --- | --- |
| `flexai/DeepSeek-V4-Flash-0731` | 1M | yes | no | $0.13 / $0.26 | Effort: minimal/low/medium/high/max |
| `flexai/DeepSeek-V4.1-Flash-1017` | 1M | yes | yes | $0.08 / $0.605 | Effort: low/medium/high |
| `flexai/gemma-4-26B-A4B-it` | 256K | yes | yes | $0.067 / $0.29 |  |
| `flexai/gemma-4-31b-it` | 256K | yes | yes | $0.14 / $0.4 |  |
| `flexai/GLM-4.5-Air-FP8` | 128K | yes | no | $0.14 / $0.86 |  |
| `flexai/GLM-5.2` | 1M | yes | no | $0.6 / $2 | Effort: low/medium/high |
| `flexai/GLM-5.3-Flash` | 1M | yes | yes | $0.088 / $0.25 | Effort: minimal/low/medium/high/max |
| `flexai/gpt-oss-120b` | 128K | yes | no | $0.03 / $0.15 | Effort: low/medium/high |
| `flexai/gpt-oss-20b` | 128K | yes | no | $0.018 / $0.09 | Utility default; Effort: low/medium/high |
| `flexai/Llama-3.3-70B-Instruct-FP8` | 128K | no | no | $0.22 / $0.5 |  |
| `flexai/Meta-Llama-3.1-8B-Instruct-FP8` | 128K | no | no | $0.05 / $0.08 |  |
| `flexai/MiMo-V2.6-Flash-RL` | 1M | yes | yes | $0.14 / $0.28 |  |
| `flexai/MiniMax-M3.1-Flash` | 1M | yes | yes | $0.15 / $0.6 | Effort: low/medium/high |
| `flexai/Mistral-Nemo-Instruct-2407-FP8` | 128K | no | no | $0.023 / $0.03 |  |
| `flexai/Muse-Glimmer-30B` | 128K | yes | yes | $0.35 / $1.5 |  |
| `flexai/NVIDIA-Nemotron-3.5-Lightning-30B-A3B` | 1M | yes | no | $0.06 / $0.16 |  |
| `flexai/PaddleOCR-VL` | 128K | no | yes | $0.14 / $0.8 | OCR model, no tools; see [PaddleOCR-VL](#paddleocr-vl) |
| `flexai/Qwen3-30B-A3B-Thinking-2507-FP8` | 256K | yes | no | $0.2 / $2.4 |  |
| `flexai/Qwen3-Coder-30B-A3B-Instruct-FP8` | 256K | no | no | $0.07 / $0.28 |  |
| `flexai/Qwen3.5-9B` | 256K | yes | yes | $0.1 / $0.15 |  |
| `flexai/Qwen3.6-27B-FP8` | 256K | yes | yes | $0.25 / $2 |  |
| `flexai/Qwen3.6-35B-A3B-FP8` | 256K | yes | yes | $0.1 / $0.95 |  |
| `flexai/Qwen3.8-27B` | 256K | yes | yes | $0.2 / $2.5 | Effort: low/medium/high |
| `flexai/Qwen3.8-Flash-Next` | 256K | yes | yes | $0.15 / $0.47 | Effort: low/medium/high |

### Reasoning effort

`reasoning_effort` is validated per route rather than uniformly. In measurements
on 2026-10-02 the gpt-oss routes accepted `low`, `medium` and `high` and rejected
anything else; `DeepSeek-V4-Flash-0731` and `GLM-5.3-Flash` additionally accepted
`minimal` and `max` while rejecting unknown spellings. Other routes advertising
`reasoning_effort` are declared with `low`/`medium`/`high`, the levels every
validating route accepts. Accepting a level is not evidence that it changes the
result.

Models that reason return their trace in a non-standard `reasoning_content`
field on the assistant message.

### Forced tool choice

Forcing a specific function with `tool_choice: {"type": "function", ...}` is
honored per model. As of 2026-10-02, `gemma-4-31b-it` declined, and FlexAI
returned `400` naming the model rather than silently answering without the call.

## Beyond chat

The plugin registers these capabilities next to the chat provider, all under
provider id `flexai` and the same API key. Model ids are the canonical ids
`GET /v1/models` reports. Prices are from the listing and are not applied to
OpenClaw's cost estimates for media calls.

| Capability | Model | FlexAI endpoint | Listing price |
| --- | --- | --- | --- |
| Image generation | `FLUX.1-schnell` | `POST /v1/images/generations` | $0.0005 per image |
| Speech (TTS) | `Kokoro-82M` | `POST /v1/audio/speech` | $0.99 per 1M characters |
| Audio transcription | `whisper-large-v3-turbo` | `POST /v1/audio/transcriptions` | $0.0002 per audio minute |
| Audio transcription | `parakeet-tdt-0.6b-v3` | `POST /v1/audio/transcriptions` | $0.001 per audio minute |
| Image understanding | vision chat rows | `POST /v1/chat/completions` | chat price |
| Embeddings | `bge-m3` | `POST /v1/embeddings` | $0.01 per 1M tokens |
| Video generation | `MiniMax-H3` | `POST /v1/videos/generations` | $0.08 per video second |

Each one runs from the command line as well as from agents:

```bash
openclaw infer image generate --model flexai/FLUX.1-schnell --prompt "a red apple" --size 1024x1024
openclaw infer tts convert --provider flexai --model flexai/Kokoro-82M --text "Hello" --output hello.wav
openclaw infer audio transcribe --file hello.wav
openclaw infer image describe --file photo.png
openclaw infer embedding create --provider flexai --model flexai/bge-m3 --text "hello"
openclaw infer video generate --model flexai/MiniMax-H3 --prompt "a paper boat on a pond" --size 768x768
```

Select FlexAI as the default for a capability in your config:

```json5
{
  agents: {
    defaults: {
      mediaModels: {
        image: { primary: "flexai/FLUX.1-schnell" },
        video: { primary: "flexai/MiniMax-H3", timeoutMs: 600000 },
      },
    },
  },
  tts: { provider: "flexai" },
  memory: { search: { provider: "flexai", model: "bge-m3" } },
}
```

### Image generation

`FLUX.1-schnell` generates one image per request (FlexAI rejects `n > 1`) and
accepts any `WxH` with each side from 64 to 2048; the plugin offers `512x512`,
`768x768`, `1024x1024`, `1024x768` and `768x1024` and defaults to `1024x1024`.
Image editing is not supported and is declared as disabled.

### Speech

`Kokoro-82M` returns `wav` only: FlexAI answers `400` to `mp3`, `opus`, `flac`
and `pcm`, so the plugin accepts only `wav` as a response format and marks the
output as not voice-note compatible. Voices are the Kokoro voices (`af_heart`,
the default, plus `af_bella`, `af_sky`, `am_adam`, `am_michael`) and the OpenAI
aliases (`alloy`, `echo`, `fable`, `nova`, `onyx`, `shimmer`). FlexAI rejects an
unknown voice with a `400` naming the accepted forms.

### Audio transcription

`whisper-large-v3-turbo` is the default for audio files. To use
`parakeet-tdt-0.6b-v3` (English), list it as the audio model:

```json5
{
  tools: {
    media: {
      models: [{ provider: "flexai", model: "parakeet-tdt-0.6b-v3", capabilities: ["audio"] }],
    },
  },
}
```

### Embeddings

`bge-m3` returns 1024-dimension vectors with an 8K-token context and backs
`memory.search` when `provider` is `flexai`.

### Video generation

`MiniMax-H3` is text-to-video. FlexAI runs it as an asynchronous job: the plugin
submits `POST /v1/videos/generations`, polls `GET /v1/videos/generations/{id}`,
and the completed job carries the clip inline as base64. A clip takes roughly
30 to 60 seconds. `size` maps to `width` and `height` (`768x768` is the size
offered; omit it to use FlexAI's default). FlexAI accepts no duration, aspect
ratio or resolution parameter on this route, so those hints are ignored.
FlexAI hands each completed clip out once: reading a finished job a second time
answers `410 job_already_retrieved`, so a failed download cannot be retried. The
response is read under OpenClaw's 16 MiB JSON limit. Image-to-video is not
enabled.

## Vision

Image input is declared from the listing's `input_modalities` and checked with a
real request carrying an `image_url` content part. These rows accept images and
read a test image back correctly:

| Model ref | Notes |
| --- | --- |
| `flexai/DeepSeek-V4.1-Flash-1017` | |
| `flexai/gemma-4-26B-A4B-it` | Default for image understanding |
| `flexai/gemma-4-31b-it` | |
| `flexai/GLM-5.3-Flash` | |
| `flexai/MiMo-V2.6-Flash-RL` | |
| `flexai/MiniMax-M3.1-Flash` | |
| `flexai/Muse-Glimmer-30B` | |
| `flexai/Qwen3.5-9B` | |
| `flexai/Qwen3.6-27B-FP8` | |
| `flexai/Qwen3.6-35B-A3B-FP8` | |
| `flexai/Qwen3.8-27B` | |
| `flexai/Qwen3.8-Flash-Next` | |
| `flexai/PaddleOCR-VL` | OCR model, see below |

Two ways to use them: attach an image to an agent turn on one of these models,
or run `openclaw infer image describe --file <path> [--model flexai/<id>]`, which
sends the image to the default vision model (or the one you name) and returns
its description. Listed models that also declare audio or video input
(`MiMo-V2.6-Flash-RL`, `MiniMax-M3.1-Flash`) are declared here for image input
only.

### PaddleOCR-VL

`PaddleOCR-VL` is a 0.9B document OCR model. It accepts image input through chat
completions and returns the text it reads, so it is declared as a chat row with
image input and no tool support. Use it for OCR through
`openclaw infer image describe --model flexai/PaddleOCR-VL`. It is not a general
agent model: in a full agent turn, with OpenClaw's long system prompt, it did not
produce a usable answer.

## Manual config

Most setups only need the API key. Use explicit `models.providers.flexai` config to override model metadata in `mode: "merge"`; leave `models` empty to use discovered rows without pinning generated prices:

```json5
{
  env: { vars: { FLEXAI_API_KEY: "..." } },
  agents: {
    defaults: {
      model: {
        primary: "flexai/DeepSeek-V4.1-Flash-1017",
        fallbacks: ["flexai/GLM-5.3-Flash"],
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      flexai: {
        baseUrl: "https://api.flex.ai/v1",
        apiKey: "${FLEXAI_API_KEY}",
        api: "openai-completions",
        models: [],
      },
    },
  },
}
```

To use a different FlexAI endpoint, set `baseUrl` to it and declare the `models`
you want: OpenClaw requires a `models` list when a non-bundled provider
overrides its base URL.

If the Gateway runs as a daemon (launchd, systemd, Docker), make sure `FLEXAI_API_KEY` is available to that process, for example in `~/.openclaw/.env` or through `env.shellEnv`. A key exported only in an interactive shell will not help a managed service unless the env is imported separately.

## Related

- [Model providers](https://docs.openclaw.ai/concepts/model-providers): choosing providers, model refs, and failover behavior.
- [Thinking modes](https://docs.openclaw.ai/tools/thinking): reasoning effort levels.
- [Models FAQ](https://docs.openclaw.ai/help/faq-models): auth profiles, switching models, and "no profile" errors.
