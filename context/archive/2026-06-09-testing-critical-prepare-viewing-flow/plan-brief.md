# Critical Prepare-Viewing Flow Tests - Plan Brief

> Full plan: `context/changes/testing-critical-prepare-viewing-flow/plan.md`
> Research: `context/changes/testing-critical-prepare-viewing-flow/research.md`

## What & Why

This plan adds deterministic app-level tests for the prepare-viewing flow. It protects the main buyer path after saving a long pasted offer and verifies that answered, unanswered, doubtful, and unmapped extraction buckets stay distinct.

Live LLM checks remain on-demand only. The normal per-change test command must not call OpenRouter.

## Starting Point

The product flow already exists on `/offers/[id]`: a buyer can trigger preparation, persist one completed result, and review four result sections. The repo currently has pgTAP database contracts and a live extraction contract script, but no JS app test runner.

## Desired End State

`pnpm run test:app` runs fast deterministic Vitest tests without browser automation, Supabase runtime, or OpenRouter secrets. Provider parsing, local unanswered completion, too-large rejection, and prepare orchestration are covered with fake fetchers and an injected extractor.

The browser smoke is documented as a seeded persisted-result check, proving the user-visible page renders source content and all four buckets without a live LLM call.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Test seam | Add extractor injection to `prepareOfferViewing` | Enables deterministic orchestration tests without module mocking or OpenRouter. | User |
| Browser smoke | Seed a persisted four-bucket result directly | Verifies the UI cheaply and keeps live provider checks separate. | User |
| Long-offer fixture | Below-limit success plus above-limit negative case | Covers both the primary long-offer path and the pre-provider guardrail. | User |
| Test runner | Vitest | Fits Vite TypeScript imports and needs minimal setup. | User + Context7 |
| Phase boundary | Automated deterministic tests plus manual smoke recipe | Gives useful protection now without premature browser automation. | User |
| Live LLM checks | On-demand only | Avoids cost, secrets, and network flakiness on every change. | Research |

## Scope

**In scope:**

- Add Vitest and `pnpm run test:app`.
- Add test-only aliases for `@/*` and `astro:env/server`.
- Test `callOpenRouterExtraction` with fake `fetch`.
- Test above-limit input rejection before provider calls.
- Add extractor injection to `prepareOfferViewing`.
- Test prepare orchestration with a narrow fake Supabase client.
- Document seeded-result manual smoke and update the test-plan cookbook.

**Out of scope:**

- Browser automation.
- CI workflow wiring.
- Live OpenRouter calls in per-change tests.
- Supabase migrations or new RLS contracts.
- Broad mocking framework or reusable test abstraction.

## Architecture / Approach

Vitest runs focused TypeScript service tests in Node. Provider tests exercise the real parser/completion path through fake responses. Prepare tests inject a fake extractor into the real orchestration service, while database ownership and RLS remain covered by existing pgTAP tests. Manual smoke validates the rendered offer detail page with seeded persisted data.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Test Harness | Vitest config, env stub, `test:app` script | Test config accidentally depends on browser, Astro runtime, or secrets. |
| 2. Extraction Boundary | Fake-fetch provider tests and too-large guard test | Tests mirror production completion logic instead of asserting oracle values. |
| 3. Prepare Orchestration | Extractor seam and service tests | Fake client overclaims DB/RLS coverage. |
| 4. Smoke Cookbook | Manual smoke recipe and test-plan cookbook updates | Future agents accidentally run live LLM checks on every change. |

**Prerequisites:** local dependencies installable through pnpm; no OpenRouter key required for `test:app`.
**Estimated effort:** about 2 implementation sessions across 4 phases.

## Open Risks & Assumptions

- Vitest dependency installation may update one or both lockfiles; implementation must preserve CI package-manager expectations.
- The fake Supabase client must stay narrowly scoped to orchestration behavior and not replace pgTAP database contracts.
- Manual smoke depends on local auth/Supabase setup; if unavailable, record the blocker instead of substituting a live LLM call.

## Success Criteria (Summary)

- `pnpm run test:app`, `pnpm run lint`, and `pnpm run build` pass without `OPENROUTER_API_KEY`.
- Tests prove bucket completion and too-large rejection without network calls.
- The cookbook clearly separates deterministic per-change tests from on-demand live extraction checks.
