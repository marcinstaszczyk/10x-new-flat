# Extraction Contract Check Implementation Plan

## Overview

Establish the minimal extraction contract and verification path that must exist before S-03 builds the review UI. The change defines a typed four-bucket extraction result, calls OpenRouter server-side with `openai/gpt-5.5` using low reasoning effort, validates strict JSON output, and proves the contract against a controlled fixture.

This slice intentionally does not persist extraction results and does not expose extraction in the UI. It answers whether the app can turn pasted flat-offer content plus buyer questions into a bounded, reviewable result within the 60-second product constraint.

## Current State Analysis

Saved offers are implemented and protected. `flat_offers` stores private pasted content with RLS, `src/lib/services/offers.ts` exposes list/create/detail/delete operations, and `/offers` lets buyers save and revisit source material. The question base is also implemented through `src/lib/services/questions.ts` and lazy initialization on `/dashboard`.

There is no extraction implementation yet. The repository has no OpenRouter client, no extraction DTOs, no extraction verification script, and no persisted extraction-result schema. The roadmap defines F-02 as the foundation slice that unlocks S-03, and the PRD requires four user-facing result categories: extracted question-answer pairs, unanswered questions, doubtful facts, and unmapped offer information.

### Key Discoveries

- F-02 outcome is "a minimal extraction contract and verification path" for latency, doubtful values, and unmapped information (`context/foundation/roadmap.md`).
- S-03 depends on F-02 and S-02, so this change should unblock the extracted viewing-preparation flow without building that flow (`context/foundation/roadmap.md`).
- PRD guardrails require no invented facts, doubtful/unknown marking, no repeated questions for known facts unless doubt exists, and usable extraction within 60 seconds (`context/foundation/prd.md`).
- Infrastructure guidance warns against CPU-heavy local parsing in Cloudflare Workers; extraction should be an external API call plus light validation (`context/foundation/infrastructure.md`).
- Astro env schema currently declares only Supabase secrets; OpenRouter variables must be added through `astro.config.mjs` and mirrored in `.env.example`.
- OpenRouter docs support direct `fetch` to `https://openrouter.ai/api/v1/chat/completions`, strict `response_format` JSON schema, and `reasoning.effort = "low"`.

## Desired End State

- The app has a stable extraction contract with four top-level buckets: answered question pairs, unanswered questions, doubtful facts, and unmapped facts.
- A server-only extraction service can call OpenRouter with `openai/gpt-5.5`, low reasoning effort, strict JSON schema output, and a hard timeout below the 60-second product limit.
- Provider failures, timeout, missing configuration, and invalid model output return explicit typed errors without leaking pasted content into logs or UI.
- A repeatable fixture command validates the contract shape and minimum semantic invariants against one controlled flat-offer sample.
- S-03 can later attach this contract to saved offers and buyer questions without redesigning the extraction result shape.

## What We're NOT Doing

- No extraction UI, review page, API route, button, or saved-offer detail integration.
- No database tables, migrations, RLS policies, or persisted extraction results.
- No background jobs, queues, retries, streaming UI, web scraping, link import, PDF parsing, or local heavy parsing.
- No scoring, recommendation, automatic evaluation, offer comparison, or closed yes/no questionnaire conversion.
- No broad model-selection abstraction; OpenRouter is the provider for this slice.
- No application test runner introduction.

## Implementation Approach

Add a small extraction service in `src/lib/services/extraction.ts` with local DTOs, a zod-backed output validator, prompt construction, timeout handling, and direct OpenRouter `fetch`. Keep configuration server-only through Astro env fields and small constants. Add fixture files plus a Node script that sends the controlled fixture through OpenRouter and checks strict schema validity plus stable invariants.

The contract remains app-facing and storage-agnostic. S-03 can consume the service result and decide persistence/UI behavior later.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Slice scope | Contract probe only | Keeps F-02 as a foundation check and avoids building S-03 early. |
| Result shape | Four buckets | Matches PRD outputs and prevents unmapped/doubtful information from being lost. |
| Verification | Golden fixture plus schema/invariant validation | Makes the check repeatable without relying on exact LLM wording. |
| Provider | OpenRouter API with `openai/gpt-5.5` and low reasoning effort | Uses the requested provider/model while keeping future model changes configurable. |
| Persistence | No database table | Avoids locking schema before the S-03 UX and lifecycle are designed. |
| Latency | Hard timeout and typed failure result | Makes the 60-second requirement executable. |
| Artifacts | `src/lib/services/extraction.ts` plus fixture script/docs | Gives S-03 reusable code and a clear verification path. |

## Phase 1: Define the Extraction Contract and Provider Boundary

### Overview

Add the server-only configuration, DTOs, validation, and OpenRouter call boundary. This phase should compile without requiring a live API key; missing configuration returns an explicit error.

### Changes Required

#### 1. Server-only OpenRouter configuration

**Files**: `astro.config.mjs`, `.env.example`, `.env`, `.dev.vars`

**Intent**: Make OpenRouter secrets available only on the server and keep local setup discoverable.

**Contract**:

- Add `OPENROUTER_API_KEY` as a server secret env field.
- Add optional `OPENROUTER_MODEL` with default behavior in code, not as a required secret.
- Add optional attribution variables only if the implementation uses `HTTP-Referer` or `X-OpenRouter-Title`.
- Mirror non-sensitive variable names in `.env.example`; never include a real key.
- Keep `.env` and `.dev.vars` aligned with the same OpenRouter variable names for local development, using empty placeholders unless the developer already has a local key.
- Document hosted setup through Cloudflare Worker secrets instead of committed Wrangler plaintext variables.
- Preserve existing Supabase env fields.

#### 2. Extraction DTOs

**File**: `src/types.ts`

**Intent**: Expose the stable app-facing extraction result shape that S-03 will later render.

**Contract**:

- Add input DTOs for an extraction request: saved offer identity/title/content and buyer question rows needed for mapping.
- Add `ExtractionResult` with exactly four top-level data buckets:
  - `answeredQuestions`
  - `unansweredQuestions`
  - `doubtfulFacts`
  - `unmappedFacts`
- Answered rows reference the buyer question ID, question text, answer text, evidence text, and confidence.
- Unanswered rows reference the buyer question ID, question text, and a short reason.
- Doubtful facts include label, value or `null`, evidence, reason, and optional related question ID.
- Unmapped facts include label, value, and evidence.
- Keep DTOs storage-agnostic; no database row type is introduced.

#### 3. Extraction service

**File**: `src/lib/services/extraction.ts`

**Intent**: Keep prompt construction, provider calls, output validation, and failure handling out of future pages/API routes.

**Contract**:

- Export a single main function such as `extractOfferPreparation(input, options?)`.
- Use direct `fetch` against `https://openrouter.ai/api/v1/chat/completions`.
- Default model is `openai/gpt-5.5`; allow override through `OPENROUTER_MODEL` or an explicit test option.
- Send `reasoning: { effort: "low", exclude: true }`.
- Send `stream: false`, low temperature, and strict `response_format` JSON schema.
- Set a bounded output budget with `max_tokens` so model latency and cost stay inside the fixture and product budget.
- Use `AbortController` with a timeout below 60 seconds, recommended 55 seconds.
- Validate input before calling the provider:
  - reject pasted offer content above a named character limit,
  - reject question lists above a named count limit,
  - return a typed `input_too_large` failure instead of truncating silently.
- Parse `choices[0].message.content` as JSON and validate it with zod before returning success.
- Return a typed result:
  - `ok: true`, `result`, and metadata such as `model` and `latencyMs`.
  - `ok: false`, `reason` as `configuration | input_too_large | timeout | provider | invalid_output`, and safe diagnostic text.
- Never accept a client-supplied buyer ID.
- Never log pasted offer content, full prompts, or raw model output by default.

#### 4. Prompt and schema contract

**File**: `src/lib/services/extraction.ts`

**Intent**: Make model behavior match the PRD guardrails instead of returning generic summaries.

**Contract**:

- System instructions must state that the model cannot invent facts and must use only pasted offer content.
- The prompt must separate offer content from buyer questions.
- The prompt must require known facts to become answered question pairs, absent facts to become unanswered questions, suspicious or uncertain values to become doubtful facts, and useful unmatched facts to become unmapped facts.
- The JSON schema must reject additional top-level properties.
- The JSON schema must bound bucket sizes and string lengths for answers, evidence, labels, values, and reasons.
- Evidence fields must be short excerpts or summaries from the pasted content, not external claims.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes with no OpenRouter key configured.
- TypeScript build proves the extraction service and DTOs compile in the Cloudflare Worker target.

#### Manual Verification

- Review `src/types.ts` and confirm the four-bucket result shape matches the PRD.
- Review `src/lib/services/extraction.ts` and confirm all failure paths are typed and safe.
- Review env handling and confirm OpenRouter values are server-only.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Add the Fixture Contract Check

### Overview

Create one controlled extraction fixture and a repeatable command that proves the OpenRouter call can return a valid contract result within the timeout budget.

### Changes Required

#### 1. Golden extraction fixture

**Files**: `scripts/fixtures/extraction-contract/offer.txt`, `scripts/fixtures/extraction-contract/questions.json`, `scripts/fixtures/extraction-contract/expected.json`

**Intent**: Keep the verification input small, realistic, and reviewable.

**Contract**:

- The offer fixture contains pasted flat-offer content with:
  - at least one fact that should answer a buyer question,
  - at least one missing fact that should leave a question unanswered,
  - at least one uncertain or suspicious value that should become doubtful,
  - at least one useful offer fact that does not map to any fixture question.
- The question fixture uses stable IDs and open questions shaped like buyer questions.
- The expected fixture defines structural invariants rather than exact prose:
  - minimum count for each bucket,
  - required fixture question IDs that must appear in answered/unanswered buckets,
  - at least one doubtful fact and one unmapped fact,
  - maximum allowed latency of 60 seconds.

#### 2. Contract check script

**File**: `scripts/check-extraction-contract.mjs`

**Intent**: Give implementers and reviewers one command that verifies the provider contract without adding a full test framework.

**Contract**:

- Read the fixture files from `scripts/fixtures/extraction-contract/`.
- Require `OPENROUTER_API_KEY`; fail with a clear setup message when missing.
- Use `OPENROUTER_MODEL` when present; otherwise use `openai/gpt-5.5`.
- Reuse the extraction service's schema, prompt/request builder, timeout constants, and provider call path where practical, or extract those pieces into a small shared module owned by `src/lib/services/extraction.ts`.
- Do not duplicate the OpenRouter request shape in the script; the fixture check must fail if the app-facing service contract drifts.
- Validate JSON shape and expected invariants.
- Fail nonzero on timeout, provider error, invalid JSON, schema failure, or invariant failure.
- Print only safe summary data: model, latency, bucket counts, and failure reason.
- Do not print the pasted offer content, prompt, API key, or full raw response.

#### 3. Package script

**File**: `package.json`

**Intent**: Make the contract check discoverable through the existing script workflow.

**Contract**:

- Add a script such as `check:extraction-contract` that runs `node scripts/check-extraction-contract.mjs`.
- Do not add a general test runner.
- Do not make the live OpenRouter check part of `pnpm run build`; it requires a secret and network access.

#### 4. Documentation

**Files**: `README.md`, `context/changes/extraction-contract-check/change.md`

**Intent**: Document how F-02 is verified and what remains for S-03.

**Contract**:

- README documents the OpenRouter env variables, the contract check command, and the fact that the check uses live provider access.
- README states that extraction results are not persisted or visible in the UI in this slice.
- Change notes summarize the chosen contract decisions and the verification command.
- Mention that hosted/CI use requires a human-approved OpenRouter secret.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes.
- With `OPENROUTER_API_KEY` configured, `pnpm run check:extraction-contract` completes successfully within 60 seconds and prints safe bucket-count output.
- Without `OPENROUTER_API_KEY`, `pnpm run check:extraction-contract` fails with a clear configuration message and does not print sensitive data.

#### Manual Verification

- Review the fixture and confirm it covers answered, unanswered, doubtful, and unmapped cases.
- Review a successful command output and confirm no pasted offer content or API key is printed.
- Confirm the result is good enough to unblock S-03 planning without adding persistence in F-02.

**Implementation Note**: After automated and manual verification pass, pause for final human confirmation before closing the change.

---

## Testing Strategy

### Type and Build Gates

- Use `pnpm run lint` and `pnpm run build` as the repository gates.
- Build must pass without OpenRouter secrets because local and CI builds should not require live provider access.

### Contract Probe

- Use `pnpm run check:extraction-contract` for the live OpenRouter verification.
- Treat missing configuration as an expected negative path, not a broken build.
- Validate bucket shape and fixture invariants; avoid exact natural-language matching.

### Manual Review

- Review the prompt for PRD guardrails: no invented facts, uncertain values marked doubtful, known facts mapped to answered questions, absent facts left unanswered.
- Review output logs for secret and pasted-content safety.

## Performance Considerations

- The service uses one external request and light JSON validation only.
- Timeout should leave margin inside the 60-second product requirement; 55 seconds is the recommended service budget.
- Define named limits for maximum pasted offer characters, maximum buyer question count, maximum model output tokens, maximum bucket counts, and maximum evidence string length.
- Requests that exceed the named input limits return the typed `input_too_large` failure without sending pasted content to OpenRouter.
- Keep fixture content short enough to exercise the contract without measuring large-document behavior.
- Do not add local parsing packages that depend on unsupported Node APIs or increase Cloudflare Worker CPU risk.

## Migration Notes

- No Supabase migration is added.
- No extraction result table is created.
- Future S-03 persistence must decide whether extraction results cascade with `flat_offers(id)` deletion.
- If this slice rolls back, only code, scripts, docs, and env declarations are affected.

## References

- Change identity: `context/changes/extraction-contract-check/change.md`
- Roadmap F-02 and S-03: `context/foundation/roadmap.md`
- PRD extraction guardrails: `context/foundation/prd.md`
- Infrastructure extraction risk: `context/foundation/infrastructure.md`
- Saved offer service: `src/lib/services/offers.ts`
- Question service: `src/lib/services/questions.ts`
- Astro env schema: `astro.config.mjs`
- OpenRouter API docs via Context7: `/websites/openrouter_ai`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Define the Extraction Contract and Provider Boundary

#### Automated

- [ ] 1.1 `pnpm run lint` passes.
- [ ] 1.2 `pnpm run build` passes with no OpenRouter key configured.
- [ ] 1.3 TypeScript build proves the extraction service and DTOs compile in the Cloudflare Worker target.

#### Manual

- [ ] 1.4 Review `src/types.ts` and confirm the four-bucket result shape matches the PRD.
- [ ] 1.5 Review `src/lib/services/extraction.ts` and confirm all failure paths are typed and safe.
- [ ] 1.6 Review env handling and confirm OpenRouter values are server-only.

### Phase 2: Add the Fixture Contract Check

#### Automated

- [ ] 2.1 `pnpm run lint` passes.
- [ ] 2.2 `pnpm run build` passes.
- [ ] 2.3 With `OPENROUTER_API_KEY` configured, `pnpm run check:extraction-contract` completes successfully within 60 seconds and prints safe bucket-count output.
- [ ] 2.4 Without `OPENROUTER_API_KEY`, `pnpm run check:extraction-contract` fails with a clear configuration message and does not print sensitive data.

#### Manual

- [ ] 2.5 Review the fixture and confirm it covers answered, unanswered, doubtful, and unmapped cases.
- [ ] 2.6 Review a successful command output and confirm no pasted offer content or API key is printed.
- [ ] 2.7 Confirm the result is good enough to unblock S-03 planning without adding persistence in F-02.
