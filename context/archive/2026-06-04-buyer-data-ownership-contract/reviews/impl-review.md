<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Buyer Data Ownership Contract

- **Plan**: `context/changes/buyer-data-ownership-contract/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 0 observations
- **Triage result**: all findings fixed

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification

| Command | Result |
|---------|--------|
| `.\node_modules\.bin\supabase.CMD db reset` | PASS |
| `.\node_modules\.bin\supabase.CMD test db` | PASS, 78 tests |
| `pnpm.cmd run lint` | PASS |
| `pnpm.cmd run build` | PASS |

## Findings

### F1 - Buyer questions allow client-controlled provenance

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260604211412_create_question_ownership_contract.sql:102`
- **Detail**: `authenticated` originally received unrestricted `insert, update` on all `buyer_questions` columns. RLS protected ownership, but buyers could still set or rewrite `source_template_id` on their own rows and set client-controlled timestamps on insert.
- **Fix**: Added `supabase/migrations/20260605091000_restrict_buyer_question_client_writes.sql` to default `buyer_id` from `auth.uid()`, revoke broad insert/update privileges, and grant direct client writes only for `question_type`, `text`, and `position`. Updated pgTAP tests to prove buyer identity defaults, personal rows have no template provenance, and protected columns cannot be inserted or updated directly.
- **Decision**: FIXED

### F2 - README still uses unpinned Supabase setup

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `README.md:87`
- **Detail**: First-time setup still told contributors to run `npx supabase init` and `npx supabase start`, even though the repository already contains `supabase/config.toml` and other database workflow docs use the pinned local CLI through `pnpm exec supabase`.
- **Fix**: Removed the obsolete `supabase init` step and changed local start/stop commands to `pnpm exec supabase start` and `pnpm exec supabase stop`.
- **Decision**: FIXED
