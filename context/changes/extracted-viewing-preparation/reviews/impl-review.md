<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Extracted Viewing Preparation

- **Plan**: `context/changes/extracted-viewing-preparation/plan.md`
- **Scope**: Phases 1-3
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 - Result JSON shape is not enforced

- **Severity**: WARNING
- **Impact**: HIGH - architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: `supabase/migrations/20260609143000_create_offer_extraction_results.sql:8`
- **Detail**: The original persistence contract only checked that `result` was a JSON object. A valid owner insert could persist `{}` or another malformed object that later crashed backend/UI rendering paths expecting the four extraction buckets.
- **Fix**: Add a persisted-result zod schema for writes, add minimal read guards for renderable buckets, and add a DB constraint plus tests for missing/non-array buckets.
  - Strength: Covers app writes, direct DB inserts, and legacy/corrupt reads without over-validating on display.
  - Tradeoff: DB validation stays intentionally shallow and does not duplicate the full zod item schema.
  - Confidence: HIGH - automated DB, lint, and build gates pass after the change.
  - Blind spot: Existing production rows would need audit/backfill before applying the new DB constraint if malformed data already exists.
- **Decision**: FIXED - implemented shared write schema, read guards, bucket constraint migration, and missing-bucket DB tests.

### F2 - Extraction contract changed outside the planned UI scope

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline / Architecture
- **Location**: `src/lib/services/extraction-contract.ts:95`, `src/lib/services/extraction-provider.ts:93`
- **Detail**: Phase 3 changed the provider contract to omit model-generated unanswered questions and synthesize them locally. That may be valid, but it changed the prior extraction contract and can cause a question to appear in both `doubtfulFacts` and `unansweredQuestions` when no substantive answer exists.
- **Fix**: Document the change as an intentional contract decision and adjust the extraction contract check so synthesized unanswered-question behavior is explicit.
  - Strength: Preserves deterministic unanswered-question coverage and updates the source of truth.
  - Tradeoff: The contract now distinguishes model output buckets from final app-result buckets.
  - Confidence: HIGH - the checker now verifies unanswered questions are generated from submitted questions not answered by the provider.
  - Blind spot: The live OpenRouter-backed contract check was not run because `OPENROUTER_API_KEY` is not set.
- **Decision**: FIXED - documented in the plan and updated the extraction contract checker/fixture.

## Verification

- `.\node_modules\.bin\supabase.CMD test db supabase/tests/database/offer_extraction_results_contract.test.sql` - PASS, 41 tests.
- `pnpm.cmd run lint` - PASS with existing `console.warn` warnings in `src/lib/services/offer-preparation.ts`.
- `pnpm.cmd run build` - PASS.
- `node --check scripts/check-extraction-contract.mjs` - PASS.
- Live extraction contract check skipped because `OPENROUTER_API_KEY` is not set.
