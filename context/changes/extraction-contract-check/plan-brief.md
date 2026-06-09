# Extraction Contract Check - Plan Brief

> Full plan: `context/changes/extraction-contract-check/plan.md`

## What & Why

Define and verify the minimal extraction contract before S-03 builds the review flow. The app needs evidence that pasted offer content plus buyer questions can produce answered pairs, unanswered questions, doubtful facts, and unmapped facts through OpenRouter within the 60-second product constraint.

## Starting Point

Saved offers and buyer question bases already exist, but there is no extraction service, no provider configuration, and no verification command. The roadmap makes this F-02 foundation slice a prerequisite for the extracted viewing-preparation UI.

## Desired End State

The repository has a server-only OpenRouter extraction boundary, a stable four-bucket result DTO, and a live fixture command that validates schema and key invariants. Nothing is persisted or shown in the UI yet; S-03 can consume the contract later.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Slice scope | Contract probe only | Keeps F-02 focused on de-risking extraction before UI work. | Plan |
| Result shape | Four buckets | Matches PRD outputs for answered, unanswered, doubtful, and unmapped information. | PRD / Plan |
| Provider | OpenRouter with `openai/gpt-5.5` | Uses the requested provider and model while keeping the model configurable. | Plan |
| Reasoning | Low effort | Starts with the requested low-cost/low-latency setting. | Plan |
| Verification | Golden fixture plus schema/invariants | Repeatable enough for review without brittle exact LLM prose matching. | Plan |
| Persistence | None | Avoids locking extraction-result schema before S-03 UX decisions. | Plan |
| Latency | Hard timeout below 60 seconds | Turns the PRD non-functional requirement into an executable check. | PRD / Plan |

## Scope

**In scope:**

- Server-only OpenRouter env configuration.
- Extraction DTOs and zod-validated four-bucket result contract.
- Direct OpenRouter `fetch` service with strict JSON schema and timeout handling.
- Fixture files and `pnpm run check:extraction-contract`.
- README and change-note documentation.

**Out of scope:**

- Extraction UI, API route, saved-offer integration, or review page.
- Database tables, migrations, persistence, RLS, or result lifecycle.
- Background jobs, retries, streaming, web scraping, link import, local heavy parsing, scoring, or offer comparison.

## Architecture / Approach

`src/lib/services/extraction.ts` owns prompt construction, OpenRouter request shape, timeout handling, and result validation. A separate fixture script calls the same provider contract with controlled offer/question input and checks bucket counts plus required mapped question IDs. Future S-03 work can call the service from a protected route and decide persistence/UI behavior then.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contract and provider boundary | Env fields, DTOs, zod schema, OpenRouter service | Output validation must be strict without overfitting to one fixture. |
| 2. Fixture contract check | Fixture inputs, script, package command, docs | Live model output may vary, so invariants must be stable but meaningful. |

**Prerequisites:** Existing saved offers/question base, local dependencies, and an OpenRouter API key for the live check.
**Estimated effort:** About 1-2 implementation sessions across 2 phases.

## Open Risks & Assumptions

- The default OpenRouter model slug is `openai/gpt-5.5`; keeping `OPENROUTER_MODEL` configurable avoids a code change if routing changes.
- A single fixture proves contract viability, not broad extraction quality.
- Exact wording should not be asserted because LLM responses can vary.
- The live check requires network access and a paid/available OpenRouter key, so it should not run inside normal build.

## Success Criteria Summary

- The extraction service compiles without OpenRouter configuration and fails safely when called without a key.
- The live fixture check returns all four result buckets within 60 seconds when configured.
- Logs and errors never expose the API key, pasted offer content, full prompt, or raw model output.
