# Code-review evaluation

The Promptfoo suite compares the production code-review prompt against two baseline fixtures: `critical-transfer` and `offer-edit-regeneration`. It is a local, paid check and is never run by package tests, CI, or the pull-request review workflow.

## Run locally

Use Node `v24.15.0`, install from the committed lockfile, and provide an OpenRouter key locally:

```powershell
npm ci
$env:OPENROUTER_API_KEY = "..."
npm run eval:review
```

The evaluation sends the shared prompt to each fixture with its own structural assertion and semantic rubric. These fixed models review every fixture:

- `openrouter:z-ai/glm-5.1`
- `openrouter:deepseek/deepseek-v4-flash`
- `openrouter:openai/gpt-5.6-luna`

GLM and DeepSeek are asked for JSON-object responses. Luna retains its existing temperature-only configuration and judges every response against the matching fixture rubric, including its own response. Results are labelled by fixture ID, so compare a model only against rows for the same fixture.

Results are saved at `.promptfoo/code-review-results.json`. A failed row means that model did not meet that fixture's baseline; it does not change PR labels or GitHub workflow results. Live runs make paid OpenRouter requests. Stable fixture IDs and the aggregate report name prepare for future comparisons only; this suite does not store trends or enforce CI gates.

`npm test`, root lint, and root build remain the required offline checks.
