# @flexai/openclaw-provider

[FlexAI](https://flex.ai) model provider plugin for [OpenClaw](https://openclaw.ai).
FlexAI serves open-weight chat models through an OpenAI-compatible API.

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

`FLEXAI_API_KEY` in the Gateway environment works too. Models are listed live
from FlexAI's `/v1/models`; the bundled catalog rows are the fallback.

Requires OpenClaw 2026.11.6 or newer. See [docs/flexai.md](docs/flexai.md) for
setup, discovery, the bundled catalog and per-model notes.

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
