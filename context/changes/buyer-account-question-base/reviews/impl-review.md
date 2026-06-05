<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Buyer Account Question Base Implementation Plan

- **Plan**: `context/changes/buyer-account-question-base/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-06-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 - Malformed reset requests bypass the safe error redirect

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/questions/reset.ts:17`
- **Detail**: The reset endpoint calls `context.request.formData()` before zod validation. A malformed body or unsupported content type can throw before the endpoint reaches the existing generic `/dashboard?reset=error` path. The normal browser form path is covered, but the route's failure behavior is less defensive than the plan's "generic retryable error marker after failure" contract.
- **Fix**: Wrap `context.request.formData()` in `try/catch` and redirect to `/dashboard?reset=error` on parse failure before running the zod validation.
- **Decision**: FIXED - Wrapped `context.request.formData()` in `try/catch` and redirect to `/dashboard?reset=error` on parse failure.

## Evidence

### Plan Drift

- Phase 1 documentation alignment is implemented in `context/foundation/prd.md`, `context/foundation/shape-notes.md`, and `context/foundation/roadmap.md`; active language now describes first question-base visit, no automatic synchronization, and explicit destructive reset.
- Phase 1 lifecycle functions are implemented in `supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql`; they derive ownership from `auth.uid()`, use buyer-scoped transaction locks, copy active templates in order, and restrict execution to `authenticated`.
- Phase 1 pgTAP coverage exists in `supabase/tests/database/question_base_lifecycle.test.sql` and covers unauthenticated denial, initialization, idempotency, inactive templates, existing rows, reset, and cross-buyer isolation.
- Phase 2 adds `BuyerQuestion` and typed Supabase shapes in `src/types.ts`, a server service in `src/lib/services/questions.ts`, static list rendering in `src/components/questions/QuestionBaseList.astro`, and dashboard initialization/rendering in `src/pages/dashboard.astro`.
- Phase 3 adds zod, both lockfiles, `src/components/questions/ResetQuestionBaseForm.tsx`, `src/pages/api/questions/reset.ts`, middleware protection for `/api/questions`, dashboard reset feedback, and README operating guidance.
- `src/lib/supabase.ts` was an unplanned support edit, but it only applies the new `Database` type to the existing request-scoped client and is necessary for the planned typed service.

### Scope Notes

- Review scope was derived from commits `dd25b63`, `8dcf130`, `09045ca`, and `66661aa`, all tied to `buyer-account-question-base`.
- Later commits `d5f6a16` and `dd61369` were excluded as separate change work, except where current database context affected interpretation.
- The current extra migration `supabase/migrations/20260605091000_restrict_buyer_question_client_writes.sql` is outside this change's plan but improves the existing ownership contract and does not conflict with the lifecycle functions.

### Automated Verification

- `pnpm run lint`: PowerShell shim blocked `pnpm.ps1`; equivalent `pnpm.cmd run lint` passed.
- `pnpm run build`: PowerShell shim blocked `pnpm.ps1`; equivalent `pnpm.cmd run build` passed.
- `pnpm exec supabase db reset`: local binary was not resolved through `pnpm exec`; equivalent `.\\node_modules\\.bin\\supabase.CMD db reset` passed.
- `pnpm exec supabase test db supabase/tests/database/question_base_lifecycle.test.sql`: equivalent `.\\node_modules\\.bin\\supabase.CMD test db supabase/tests/database/question_base_lifecycle.test.sql` passed.
- `pnpm exec supabase test db`: equivalent `.\\node_modules\\.bin\\supabase.CMD test db` passed.

### Manual Verification Evidence

- Manual verification items are marked complete in the plan with commit `09045ca`.
- The review did not rerun browser-based manual flows. It verified that the automated gates pass and that the implementation matches the documented manual flow paths.
