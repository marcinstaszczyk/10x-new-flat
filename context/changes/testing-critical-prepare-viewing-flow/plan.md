# Critical Prepare-Viewing Flow Test Plan

## Overview

Add the first application-level test layer for the prepare-viewing flow. This change protects the two highest-value risks from the rollout plan: a buyer cannot complete preparation after saving a long pasted offer, and the final result loses the distinction between answered, unanswered, doubtful, and unmapped information.

The normal per-change tests must be deterministic and must not call an LLM. Live OpenRouter verification remains available through the existing `pnpm run check:extraction-contract` command, but stays on-demand before release or when provider drift is suspected.

## Current State Analysis

The product flow already exists. A logged-in buyer saves pasted offer content, opens `/offers/[id]`, clicks `PrepareViewingButton`, posts to `/api/offers/[id]/prepare`, and reloads the page after a persisted extraction result exists. The offer detail page renders the pasted source content and, when present, `OfferPreparationResult`.

The extraction boundary is already split enough for deterministic provider tests. `callOpenRouterExtraction` accepts an injected `fetcher`, parses provider output, filters non-substantive answers, and completes `unansweredQuestions` locally. The prepare orchestration is not yet test-friendly because `prepareOfferViewing` imports the default extractor directly, so a small extractor injection seam is needed before service tests can prove behavior without OpenRouter.

The repository currently has database pgTAP contract tests only. There is no JS test runner, no app integration test command, and no browser automation harness. Vitest is the smallest useful addition because it runs TypeScript through Vite and can use a test-specific config for the existing `@/*` alias and `astro:env/server` stub.

### Key Discoveries

- The four app buckets are `answeredQuestions`, `unansweredQuestions`, `doubtfulFacts`, and `unmappedFacts` in `src/types.ts`.
- Provider output intentionally omits `unansweredQuestions`; the app synthesizes them after provider validation in `src/lib/services/extraction-provider.ts:149`.
- The input guard rejects pasted content above `MAX_OFFER_CONTENT_CHARACTERS = 100_000` in `src/lib/services/extraction-contract.ts:6`.
- `prepareOfferViewing` loads the saved offer, existing result, buyer question base, extractor, and persistence in one orchestration path in `src/lib/services/offer-preparation.ts:22`.
- The persisted result UI renders the four section counts in `src/components/offers/OfferPreparationResult.astro:94`, `:125`, `:148`, and `:170`.
- Vitest v4.1.6 docs confirm TypeScript support through Vite and top-level Vite config support for aliases; a separate `vitest.config.ts` is appropriate for test-specific settings.

## Desired End State

- `pnpm run test:app` runs fast deterministic TypeScript tests with no browser and no LLM calls.
- The provider-boundary tests prove local unanswered-question completion, doubtful-question exclusion, non-answer filtering, provider error handling, invalid output handling, and the too-large pre-provider rejection.
- The prepare orchestration can be tested with an injected fake extractor while preserving the production API call shape.
- A long-offer success fixture stays below 100,000 characters and proves the full pasted content is passed to extraction.
- A separate too-large negative case proves the app rejects above-limit input before provider fetch.
- The manual/browser smoke is documented as a seeded persisted-result check against `/offers/:id`, not a live LLM smoke.
- `context/foundation/test-plan.md` cookbook section 6 records the new command and manual smoke pattern for future rollout phases.

## What We're NOT Doing

- No live OpenRouter calls in `pnpm run test:app`, `pnpm run lint`, or `pnpm run build`.
- No browser automation or Playwright setup in this phase.
- No CI workflow changes yet; Phase 4 of the rollout owns quality-gate wiring.
- No database schema changes and no duplication of existing pgTAP ownership/RLS contracts.
- No broad test utilities framework beyond the fixtures needed by these tests.
- No change to extraction result semantics except the injection seam needed for deterministic testing.

## Implementation Approach

Add Vitest with a test-specific config. Keep config small: Node environment, explicit `@` alias to `src`, and an alias for `astro:env/server` to a test stub so importing extraction modules does not require Astro runtime secrets. Add one package script, `test:app`, for deterministic app/service tests.

Introduce an extractor option on `prepareOfferViewing` while preserving its existing two-argument production call. The API route continues to call `prepareOfferViewing(supabase, offerId)` unchanged. Tests call `prepareOfferViewing(client, offerId, { extractOfferPreparation: fakeExtractor })` and assert orchestration behavior without touching OpenRouter.

Use focused tests at the cheapest useful layer:

- Provider-boundary tests for parsing and local completion through `callOpenRouterExtraction` with fake `fetch`.
- Extraction wrapper/input-limit tests for the too-large negative case with a fetcher that fails the test if called.
- Prepare orchestration tests with injected extractor and a narrow fake Supabase client, deliberately scoped to service ordering and payload contracts, not RLS or SQL behavior.
- Manual/browser smoke recipe that seeds a persisted four-bucket result and verifies the offer detail page renders source content plus all four result sections.

## Decisions

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Test seam | Add a small extractor injection option to `prepareOfferViewing` | Enables deterministic service tests without module mocking or OpenRouter calls. | User |
| Browser smoke | Seed a persisted four-bucket result directly | Verifies user-visible rendering cheaply while leaving live provider checks on-demand. | User |
| Long-offer fixture | Below-limit success plus above-limit negative case | Covers both primary long-offer flow and the 100,000-character guardrail. | User |
| JS test runner | Add Vitest for service/provider integration tests | Fits Vite/Astro TypeScript imports with minimal setup. | User + Context7 |
| Phase stop point | Deterministic automated tests plus documented manual smoke recipe | Matches sparse test-base reality and avoids premature browser automation. | User |
| Live LLM checks | Keep `pnpm run check:extraction-contract` on-demand only | Avoids cost, secrets, and network flakiness on every change. | Research |

## Phase 1: Add Deterministic App Test Harness

### Overview

Introduce Vitest and the minimum configuration needed to run TypeScript service tests in this Astro app without requiring a browser, Supabase runtime, or OpenRouter secrets.

### Changes Required

#### 1. Vitest dependency and scripts

**Files**: `package.json`, `package-lock.json`, `pnpm-lock.yaml`

**Intent**: Make deterministic app tests discoverable through the existing package-script workflow.

**Contract**:

- Add `vitest` as a dev dependency.
- Add `test:app` that runs `vitest run`.
- Optionally add `test:app:watch` only if it does not create extra maintenance surface.
- Do not add the live OpenRouter contract check to `test:app`.
- Preserve existing `check:extraction-contract`, `lint`, and `build` scripts.
- Update both lockfiles because local workflow uses pnpm while CI runs `npm ci`.

#### 2. Test-specific Vitest config

**File**: `vitest.config.ts`

**Intent**: Keep test-only aliases and runtime assumptions out of production Astro config.

**Contract**:

- Use `defineConfig` from `vitest/config`.
- Set the test environment to `node`.
- Resolve `@` to `src` at top-level Vite config.
- Alias `astro:env/server` to a test stub.
- Include only focused service tests, for example `src/**/*.test.ts`.
- Exclude `dist`, `node_modules`, and archived context.
- Do not configure browser mode or UI mode.

#### 3. Astro env test stub

**File**: `src/test/stubs/astro-env-server.ts`

**Intent**: Let deterministic tests import extraction modules without requiring Astro runtime env injection.

**Contract**:

- Export `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` with safe test values.
- Use an empty API key by default so configuration failure remains testable.
- Do not read real environment variables.
- Do not include secrets.

### Success Criteria

#### Automated Verification

- `pnpm run test:app` has an unambiguous Phase 1 outcome: either add the first real placeholder-free test in this phase, or set Vitest `passWithNoTests` explicitly and document that it is temporary until Phase 2 adds tests.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review `vitest.config.ts` and confirm no browser mode, live provider setup, or secret lookup is configured.
- Review `package.json` and confirm `test:app` is distinct from `check:extraction-contract`.

**Implementation Note**: After automated verification passes, continue to Phase 2 in the same change; no human pause is needed because this phase only adds the harness.

---

## Phase 2: Cover Extraction Boundary and Input Guard

### Overview

Add deterministic tests for the extraction boundary that currently carries the bucket-distinction risk. These tests must use fake responses and must never call OpenRouter.

### Changes Required

#### 1. Shared extraction fixtures

**Files**: `src/test/fixtures/extraction.ts` or colocated test fixtures

**Intent**: Keep the oracle readable and independent from production transformation code.

**Contract**:

- Define stable question IDs for:
  - one answered question,
  - one question represented by a doubtful fact,
  - one unanswered question omitted by provider output,
  - one non-substantive answer that should be filtered into unanswered.
- Define provider JSON content with `answeredQuestions`, `doubtfulFacts`, and `unmappedFacts` only.
- Define expected final app buckets explicitly; do not compute expected unanswered IDs with the same logic as production.
- Define a long pasted-content fixture below `MAX_OFFER_CONTENT_CHARACTERS`, large enough to catch accidental truncation.
- Define a too-large pasted-content fixture above `MAX_OFFER_CONTENT_CHARACTERS`.

#### 2. Provider boundary tests

**File**: `src/lib/services/extraction-provider.test.ts`

**Intent**: Prove provider parsing plus local completion produce the app-facing four-bucket result.

**Contract**:

- Call `callOpenRouterExtraction` with an injected fake `fetcher`.
- Assert the request body includes the full below-limit pasted content and submitted question IDs.
- Assert a provider response with:
  - one substantive answer,
  - one non-substantive answer,
  - one doubtful fact linked to a question,
  - one unmapped fact,
  produces:
  - the substantive answer in `answeredQuestions`,
  - the non-substantive answer removed from `answeredQuestions`,
  - the linked doubtful question excluded from `unansweredQuestions`,
  - omitted and non-substantive questions in `unansweredQuestions`,
  - the unmapped fact retained.
- Assert invalid JSON returns `invalid_output`.
- Assert schema-invalid JSON returns `invalid_output`.
- Assert non-OK provider responses return `provider`.
- Assert abort/timeout behavior only if it can be done without slow timers; otherwise leave timeout to existing typed service behavior and manual review.

#### 3. Extraction wrapper input-limit test

**File**: `src/lib/services/extraction.test.ts`

**Intent**: Prove too-large pasted content is rejected before the provider boundary, so the negative case is safe for every change.

**Contract**:

- Call `extractOfferPreparation` with too-large pasted content.
- Pass a fake `fetcher` that throws if called.
- Assert the result is `ok: false` with reason `input_too_large`.
- Assert the fake `fetcher` was not called.
- Do not require `OPENROUTER_API_KEY`.

### Success Criteria

#### Automated Verification

- `pnpm run test:app` passes with no network and no OpenRouter key.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review tests and confirm expected bucket IDs are literal oracle values, not copied from production completion logic.
- Review command output and confirm no pasted fixture content, provider raw output, or secrets are printed.

**Implementation Note**: If the timeout test would require fake timers that make the suite brittle, omit it from Phase 2 and rely on typed timeout handling plus the existing live contract check.

---

## Phase 3: Cover Prepare Orchestration Without LLM Calls

### Overview

Make `prepareOfferViewing` testable with an injected extractor and add focused orchestration tests for long-offer preparation, rerun blocking, question filtering, persistence, and no-write failure handling.

### Changes Required

#### 1. Extractor injection seam

**File**: `src/lib/services/offer-preparation.ts`

**Intent**: Let tests replace the extraction call while production keeps the current default behavior.

**Contract**:

- Keep the existing production call valid: `prepareOfferViewing(client, offerId)`.
- Add an optional third argument, for example:
  - `prepareOfferViewing(client, offerId, options?)`
  - `options.extractOfferPreparation`
- The injected extractor accepts the same input shape as the production extractor and returns the same typed `ExtractionServiceResult`.
- Production default still uses `extractOfferPreparation` from `src/lib/services/extraction.ts`.
- The API route in `src/pages/api/offers/[id]/prepare.ts` remains behaviorally unchanged.
- Do not add provider selection, retry, queue, or background-job abstractions.

#### 2. Prepare orchestration tests

**File**: `src/lib/services/offer-preparation.test.ts`

**Intent**: Prove the main service preserves the saved offer context, uses the right question set, and persists only successful completed results.

**Contract**:

- Use a narrow fake Supabase client fixture for only the query chains used by `loadSavedOffer`, `loadOfferExtractionResult`, `loadBuyerQuestionBase`, and `createOfferExtractionResult`.
- Test successful long-offer preparation:
  - saved offer has below-limit long pasted content,
  - extractor receives the exact title, offer ID, and full pasted content,
  - extractor receives only `open_question` rows, not category rows,
  - completed result is persisted with model and latency metadata,
  - service returns `ok: true`.
- Test rerun blocking:
  - existing result is present,
  - extractor is not called,
  - service returns `already_exists`.
- Test extractor failure:
  - fake extractor returns `input_too_large` or `provider`,
  - no result insert occurs,
  - service returns the same failure reason and safe metadata.
- Test storage failure on insert:
  - extractor succeeds,
  - insert fails,
  - service returns `storage` or `already_exists` according to existing mapping.
- Do not retest RLS, ownership, or database constraints already covered by pgTAP.

### Success Criteria

#### Automated Verification

- `pnpm run test:app` passes with no network and no OpenRouter key.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review the injection seam and confirm production callers do not need to change.
- Review the fake Supabase fixture and confirm it is limited to service orchestration, not pretending to prove RLS or SQL constraints.

**Implementation Note**: Keep the fake client local to the test file unless a second test file needs it. Avoid a broad reusable mock framework.

---

## Phase 4: Document Manual Smoke and Cookbook

### Overview

Finish the rollout phase by documenting the human/browser smoke and updating the test-plan cookbook so future agents know what to run and what not to run.

### Changes Required

#### 1. Manual/browser smoke recipe

**Files**: `context/foundation/test-plan.md`, optional `README.md` if the command needs user-facing setup

**Intent**: Make the e2e/manual smoke explicit without adding browser automation in this phase.

**Contract**:

- Document that the critical browser smoke uses a seeded persisted four-bucket result.
- The smoke must verify:
  - `/offers/:id` shows the saved offer source content,
  - all four result sections render with expected counts,
  - answered and unanswered questions appear in question-base order where IDs match,
  - doubtful and unmapped facts remain visible,
  - the prepare button is disabled or absent when a result already exists.
- The smoke must not require `OPENROUTER_API_KEY`.
- The live `pnpm run check:extraction-contract` remains a separate on-demand provider check, not a per-change gate.

#### 2. Cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Convert Phase 1 learnings into reusable project testing rules.

**Contract**:

- Fill in or update:
  - `6.2 Adding an app integration test`,
  - `6.3 Adding a critical browser/manual smoke`,
  - `6.4 Adding an on-demand live extraction check`,
  - `6.5 Per-rollout-phase notes`.
- Record `pnpm run test:app` as the deterministic service/provider test command.
- Record that too-large extraction tests must assert the provider/fetcher is not called.
- Record that live LLM checks are on-demand and require `OPENROUTER_API_KEY`.
- Update Phase 1 status from `planned` to the appropriate later status only during implementation completion, not during planning.

### Success Criteria

#### Automated Verification

- `pnpm run test:app` passes.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Follow the documented seeded-result smoke locally with `pnpm run dev`.
- Confirm the smoke does not call OpenRouter.
- Confirm cookbook wording makes the live LLM boundary clear.

**Implementation Note**: If the local Supabase/auth setup is not available during implementation, leave the manual smoke unchecked in `## Progress` and report the blocker. Do not replace it with a live LLM call.

---

## Testing Strategy

### Deterministic Automated Tests

- `pnpm run test:app` is the main per-change app test command.
- Tests use fake fetchers and injected extractors only.
- Tests must fail if a fake provider/fetcher is called in the too-large path.
- Tests assert literal expected bucket membership derived from PRD/research, not from production helper output.

### Existing Gates

- `pnpm run lint` remains required.
- `pnpm run build` remains required.
- Existing Supabase pgTAP tests remain the source of truth for table/RLS/ownership constraints; no new SQL test is needed in this phase.

### Manual Testing Steps

1. Start the app with `pnpm run dev`.
2. Sign in as a local buyer and open a saved offer detail page.
3. Ensure a completed four-bucket extraction result is seeded for that offer without calling OpenRouter.
4. Open `/offers/:id`.
5. Confirm saved source content is visible.
6. Confirm answered, unanswered, doubtful, and unmapped sections render with expected counts and visible content.
7. Confirm the prepare action is blocked when the result already exists.

### On-Demand Provider Check

- Run `pnpm run check:extraction-contract` only when intentionally checking live provider behavior.
- It requires `OPENROUTER_API_KEY`.
- It is not part of `test:app`, lint, build, or per-change verification.

## Performance Considerations

- Vitest tests should stay fast because they run in Node with fake responses.
- Fixture strings should be large enough to catch truncation but not so large that test startup becomes noisy.
- Avoid fake timers unless needed; slow timeout simulation is not worth the cost for this phase.
- Keep the injected extractor seam local to `prepareOfferViewing`; do not introduce background jobs or provider abstractions.

## Migration Notes

- No Supabase migration is planned.
- Dependency changes require lockfile updates.
- If Vitest introduces lint/build friction around globals, prefer explicit imports from `vitest` over enabling globals.
- CI wiring is intentionally deferred to rollout Phase 4.

## References

- Change identity: `context/changes/testing-critical-prepare-viewing-flow/change.md`
- Research: `context/changes/testing-critical-prepare-viewing-flow/research.md`
- Test rollout: `context/foundation/test-plan.md`
- Product oracle: `context/foundation/prd.md`
- Provider boundary: `src/lib/services/extraction-provider.ts:48`
- Local unanswered completion: `src/lib/services/extraction-provider.ts:149`
- Input guard: `src/lib/services/extraction-contract.ts:88`
- Prepare orchestration: `src/lib/services/offer-preparation.ts:22`
- Offer detail integration: `src/pages/offers/[id].astro:21`
- Result rendering: `src/components/offers/OfferPreparationResult.astro:94`
- Live contract script: `scripts/check-extraction-contract.mjs`
- Vitest docs checked through Context7: `/vitest-dev/vitest/v4.1.6`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Add Deterministic App Test Harness

#### Automated

- [x] 1.1 `pnpm run test:app` runs without browser, Supabase runtime, or OpenRouter secrets. - 3eaf98d
- [x] 1.2 `pnpm run lint` passes. - 3eaf98d
- [x] 1.3 `pnpm run build` passes. - 3eaf98d

#### Manual

- [x] 1.4 Review `vitest.config.ts` and confirm no browser mode, live provider setup, or secret lookup is configured. - 3eaf98d
- [x] 1.5 Review `package.json` and confirm `test:app` is distinct from `check:extraction-contract`. - 3eaf98d

### Phase 2: Cover Extraction Boundary and Input Guard

#### Automated

- [x] 2.1 `pnpm run test:app` passes with provider-boundary and input-limit tests.
- [x] 2.2 `pnpm run lint` passes.
- [x] 2.3 `pnpm run build` passes.

#### Manual

- [x] 2.4 Review tests and confirm expected bucket IDs are literal oracle values.
- [x] 2.5 Review command output and confirm no pasted fixture content, provider raw output, or secrets are printed.

### Phase 3: Cover Prepare Orchestration Without LLM Calls

#### Automated

- [ ] 3.1 `pnpm run test:app` passes with prepare orchestration tests.
- [ ] 3.2 `pnpm run lint` passes.
- [ ] 3.3 `pnpm run build` passes.

#### Manual

- [ ] 3.4 Review the injection seam and confirm production callers do not need to change.
- [ ] 3.5 Review the fake Supabase fixture and confirm it is scoped to service orchestration only.

### Phase 4: Document Manual Smoke and Cookbook

#### Automated

- [ ] 4.1 `pnpm run test:app` passes.
- [ ] 4.2 `pnpm run lint` passes.
- [ ] 4.3 `pnpm run build` passes.

#### Manual

- [ ] 4.4 Follow the documented seeded-result smoke locally with `pnpm run dev`.
- [ ] 4.5 Confirm the smoke does not call OpenRouter.
- [ ] 4.6 Confirm cookbook wording makes the live LLM boundary clear.
