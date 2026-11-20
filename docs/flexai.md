# FlexAI provider

[FlexAI](https://flex.ai) serves open-weight models through an OpenAI-compatible API. The plugin discovers the live catalog and its prices, with a bundled catalog for offline fallback.

| Property        | Value                                        |
| --------------- | -------------------------------------------- |
| Provider id     | `flexai`                                     |
| Plugin          | `@flexai/openclaw-provider` (ClawHub)        |
| Auth env var    | `FLEXAI_API_KEY`                             |
| Onboarding flag | `--auth-choice flexai-api-key`               |
| Direct CLI flag | `--flexai-api-key <key>`                     |
| API             | OpenAI-compatible (`openai-completions`)     |
| Base URL        | `https://api.flex.ai/v1`                     |
| Default model   | `flexai/Qwen3.6-35B-A3B-FP8`                 |

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
configured base URL and projects the chat-capable rows into the catalog. The
same endpoint also lists embedding, transcription, speech, image-generation and
OCR models; those are not selectable as chat models and are filtered out.

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

23 offline fallback chat models. Context windows, prices, tool support, reasoning
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
| `flexai/Qwen3-30B-A3B-Thinking-2507-FP8` | 256K | yes | no | $0.2 / $2.4 |  |
| `flexai/Qwen3-Coder-30B-A3B-Instruct-FP8` | 256K | no | no | $0.07 / $0.28 |  |
| `flexai/Qwen3.5-9B` | 256K | yes | yes | $0.1 / $0.15 |  |
| `flexai/Qwen3.6-27B-FP8` | 256K | yes | yes | $0.25 / $2 |  |
| `flexai/Qwen3.6-35B-A3B-FP8` | 256K | yes | yes | $0.1 / $0.95 | Default |
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

## Manual config

Most setups only need the API key. Use explicit `models.providers.flexai` config to override model metadata in `mode: "merge"`; leave `models` empty to use discovered rows without pinning generated prices:

```json5
{
  env: { vars: { FLEXAI_API_KEY: "..." } },
  agents: {
    defaults: {
      model: { primary: "flexai/Qwen3.6-35B-A3B-FP8" },
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
