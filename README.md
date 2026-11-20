# @flexai/openclaw-provider

[FlexAI](https://flex.ai) model provider plugin for [OpenClaw](https://openclaw.ai).
FlexAI serves open-weight models through an OpenAI-compatible API. One plugin
covers chat (with image input on vision models), image generation, speech,
audio transcription, image understanding, embeddings and video generation.

| Capability | FlexAI model | OpenClaw surface |
| --- | --- | --- |
| Chat, vision chat | 24 bundled rows plus live discovery | `flexai/<model>` |
| Image generation | `FLUX.1-schnell` | `openclaw infer image generate` |
| Speech (TTS) | `Kokoro-82M` | `openclaw infer tts convert` |
| Audio transcription | `whisper-large-v3-turbo`, `parakeet-tdt-0.6b-v3` | `openclaw infer audio transcribe` |
| Image understanding | any FlexAI vision row (default `gemma-4-26B-A4B-it`) | `openclaw infer image describe` |
| Embeddings (memory search) | `bge-m3` | `memory.search.provider: "flexai"` |
| Video generation | `MiniMax-H3` | `openclaw infer video generate` |

One API key covers all of them.

## Install

```bash
openclaw plugins install @flexai/openclaw-provider
openclaw gateway restart
```

Save a FlexAI API key and pick a model:

```bash
openclaw models auth paste-api-key --provider flexai
openclaw models list --provider flexai
```

`FLEXAI_API_KEY` in the Gateway environment works too. Chat models are listed
live from FlexAI's `/v1/models`; the bundled catalog rows are the fallback.

Requires OpenClaw 2026.11.6 or newer. OpenClaw asks you to accept the plugin's
capabilities at install time (`--accept-capabilities` when scripting). See
[docs/flexai.md](docs/flexai.md) for setup, per-capability configuration, which
models take images, discovery, the bundled catalog and per-model notes.

## Vision

These bundled chat rows accept image input (`input: ["text", "image"]`):
`DeepSeek-V4.1-Flash-1017`, `gemma-4-26B-A4B-it`, `gemma-4-31b-it`,
`GLM-5.3-Flash`, `MiMo-V2.6-Flash-RL`, `MiniMax-M3.1-Flash`, `Muse-Glimmer-30B`,
`Qwen3.5-9B`, `Qwen3.6-27B-FP8`, `Qwen3.6-35B-A3B-FP8`, `Qwen3.8-27B`,
`Qwen3.8-Flash-Next`, plus the OCR model `PaddleOCR-VL`. Attach an image to an
agent turn on any of them, or run `openclaw infer image describe --file <path>`.

## Using a different FlexAI endpoint

To point the provider at a different FlexAI endpoint, declare the provider
block under `models.providers.flexai` in your OpenClaw config with its `baseUrl`
and a `models` list (OpenClaw requires models for a non-bundled provider that
overrides `baseUrl`).

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
