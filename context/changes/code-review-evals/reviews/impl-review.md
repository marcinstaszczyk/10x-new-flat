<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Promptfoo code-review evaluation implementation plan

- **Plan**: `context/changes/code-review-evals/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-07-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Static assertion accepts legacy flat review JSON

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `packages/code-review/evals/assertions/review-result.ts:6`
- **Detail**: The assertion claims to require canonical nested JSON, but `parseReview()` intentionally accepts legacy flat output. A flat failing response with low scores can pass, violating the plan's explicit requirement to reject legacy flat output.
- **Fix**: Parse the JSON and validate it with the canonical schema before applying `parseReview()` and score checks; add regression tests for flat output.
- **Decision**: FIXED

## Verification

- `npm.cmd test --prefix packages/code-review` passed: 21 tests.
- `npm.cmd run lint` passed with 3 pre-existing warnings outside this change.
- `npm.cmd run build` passed.
- Missing-key preflight passed when run without `.env` loading.
- `npm.cmd ci --prefix packages/code-review` exceeded the 120-second sandbox timeout.
- The paid live evaluation was not rerun without a supplied key.
