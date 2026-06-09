<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Extraction Contract Check

- **Plan**: context/changes/extraction-contract-check/plan.md
- **Scope**: Phases 1-2 of 2
- **Date**: 2026-06-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 - Fixture script duplicates provider call path

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: scripts/check-extraction-contract.mjs:63
- **Detail**: The plan says the fixture check should reuse the extraction service's provider call path where practical, and that the check must fail if the app-facing service contract drifts. The script reuses the prompt/request builder, timeout, and zod schema, but keeps its own OpenRouter endpoint, fetch, response handling, and JSON parsing path. A future drift in the service's provider boundary could be missed by the fixture check.
- **Fix**: Move the provider call/response parsing path into a shared module usable by both `src/lib/services/extraction.ts` and `scripts/check-extraction-contract.mjs`. Keep `astro:env/server` only in the thin service wrapper.
  - Strength: Makes the live fixture exercise the same provider boundary that future app/API callers will use.
  - Tradeoff: Requires a small module split because scripts cannot import `astro:env/server`.
  - Confidence: HIGH - the duplicated path is visible in the script and service today.
  - Blind spot: None significant.
- **Decision**: PENDING

## Verification

- `pnpm.cmd run lint` passed.
- `pnpm.cmd run build` passed.
- `pnpm.cmd run check:extraction-contract` without process key failed with the expected configuration message.
- Live OpenRouter check passed unsandboxed: `openai/gpt-5.5`, `871ms`, buckets `answered=3`, `unanswered=1`, `doubtful=1`, `unmapped=11`.
