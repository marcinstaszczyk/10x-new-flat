<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Extraction Contract Check Implementation Plan

- **Plan**: `context/changes/extraction-contract-check/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-09
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings fixed, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 6/6 existing paths confirmed, planned new files intentionally absent; core symbols confirmed; brief and plan consistent.

## Findings

### F1 - Extraction is not actually bounded

- **Severity**: WARNING
- **Impact**: HIGH - architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Desired End State, Phase 1 service contract, Performance Considerations
- **Detail**: The plan promised a bounded, 60-second extraction path, but did not define input limits, output limits, `max_tokens`, max bucket sizes, max evidence length, or a typed "too large" failure. A short fixture could pass while real pasted listings or large question bases still hit cost/latency cliffs.
- **Fix**: Add explicit service limits: max offer chars, max questions, max answer/evidence lengths, max bucket counts, `max_tokens`, and a typed `input_too_large` failure.
- **Decision**: FIXED - Phase 1 and Performance Considerations now require named input/output limits, `max_tokens`, schema length/count bounds, and `input_too_large`.

### F2 - Env file alignment misses repo rules

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Server-only OpenRouter configuration
- **Detail**: Repo rules require env changes to keep `.env`, `.dev.vars`, and `.env.example` aligned. The plan only listed `astro.config.mjs` and `.env.example`; both `.env` and `.dev.vars` exist locally.
- **Fix**: Add `.env` and `.dev.vars` to the Phase 1 file list, with placeholder/local-only OpenRouter entries, and document the Worker secret command for hosted use.
- **Decision**: FIXED - Phase 1 now lists `.env` and `.dev.vars`, requires aligned local placeholders, and calls out Cloudflare Worker secrets for hosted setup.

### F3 - Fixture script can drift from the service contract

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2, Contract check script
- **Detail**: The script was required to call the "same endpoint and request shape" as the service, but the plan did not say how that sameness is enforced. If the script duplicated schema, prompt, and request body logic, the check could pass while `src/lib/services/extraction.ts` diverged.
- **Fix**: Define shared ownership for the JSON schema, prompt/request builder, and validator, or explicitly make the script import/reuse a Node-compatible shared contract module.
- **Decision**: FIXED - Phase 2 now requires reusing the service schema, prompt/request builder, timeout constants, and provider call path where practical, or extracting those pieces into a small shared module owned by `src/lib/services/extraction.ts`.
