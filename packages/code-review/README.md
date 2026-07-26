# Code-review evaluation

The Promptfoo suite compares the production code-review prompt against one critical-transfer fixture. It is a local, paid check and is never run by package tests, CI, or the pull-request review workflow.

## Run locally

Use Node `v24.15.0`, install from the committed lockfile, and provide an OpenRouter key locally:

```powershell
npm ci
$env:OPENROUTER_API_KEY = "..."
npm run eval:review
```

The evaluation sends the same prompt and fixture to these fixed models:

- `openrouter:z-ai/glm-5.1`
- `openrouter:deepseek/deepseek-v4-flash`
- `openrouter:openai/gpt-5.6-luna`

GLM and DeepSeek are asked for JSON-object responses. Luna retains its existing temperature-only configuration and judges every response against the three seeded transfer defects, including its own response.

Results are saved at `.promptfoo/critical-transfer-results.json`. A failed row means that model did not meet this fixture’s baseline; it does not change PR labels or GitHub workflow results. Live runs make paid OpenRouter requests.

`npm test`, root lint, and root build remain the required offline checks.
