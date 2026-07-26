<!-- PLAN-REVIEW-REPORT -->

# Plan review: realistic-test-case

Status: resolved

## Findings

### [P1] Specify the permission changes that make the seeded flaws executable

The current schema explicitly withholds `UPDATE` on `flat_offers`, and explicitly denies and withholds `DELETE` on `offer_extraction_results` (`supabase/migrations/20260605100000_create_flat_offers.sql` and `supabase/migrations/20260609143000_create_offer_extraction_results.sql`). The plan requires a weak offer update policy and a service that deletes an extraction result, but it does not require the embedded migration to replace the denying policies and grant the corresponding table/column privileges. Without those changes, neither the cross-tenant update nor delete-before-regeneration can occur through the intended authenticated path.

Require the fixture diff to include the exact policy replacement and grants: an update grant plus the deliberately weak `USING` policy for offers, and an owner-scoped delete policy plus delete grant for extraction results. State that these are fixture-only changes so they are not mistaken for production changes.

### [P1] Resolve the contradiction over test files in the embedded diff

The plan repeatedly requires a source-only diff with no test-file changes, while its cited research requires a narrow happy-path test diff. These alternatives materially change the expected test-risk score and the fixture's evidence surface. An implementer cannot satisfy both.

Choose one policy and align the research, fixture contract, expected score ceilings, rubric, and fixture tests with it. If the intended choice is source-only, remove the stale research instruction and make the rubric say that missing risk coverage is inferred from the absence of tests.

### [P2] Name the configuration-test file and its observable contract

Phase 2 requires "configuration source tests" proving fixture-labelled, assertion/rubric-matched generated tests, but the listed files do not include a configuration test and no current test exercises `promptfooconfig.ts`. The existing package tests would therefore not protect the plan's central anti-cross-product guarantee.

Add `packages/code-review/evals/promptfooconfig.test.ts` to the phase and specify assertions for: one shared variableized prompt, exactly one test per registry fixture, each test carrying its fixture ID/title/diff variables, the fixture-specific JavaScript assertion, and its own rubric content. Keep this import-only so it makes no provider calls.

## Review basis

The plan is otherwise internally coherent: the fixture registry, assertion factory, single templated prompt, aggregate report name, and local-only live evaluation fit the current `packages/code-review` structure. No project code or database changes were made during this review.

## Triage

- [x] **[P1] Executable permission changes** — fixed in `plan.md`: the fixture migration now explicitly replaces the deny policies and grants the constrained update/delete privileges while remaining fixture-only.
- [x] **[P1] Embedded-test contradiction** — fixed in `research.md` and reinforced in `plan.md`: the embedded diff is source-only, and missing risk coverage is evaluated from the absence of application tests.
- [x] **[P2] Configuration-test contract** — fixed in `plan.md`: `evals/promptfooconfig.test.ts` is named and its import-only, no-provider assertions are specified.
