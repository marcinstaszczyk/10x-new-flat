# Realistic code-review evaluation case — Plan Brief

> Full plan: `context/changes/realistic-test-case/plan.md`
> Research: `context/changes/realistic-test-case/research.md`

## What & Why

Add a realistic, project-based evaluation case to the local code-review benchmark. It tests whether selected review models find three serious flaws in a plausible offer edit and preparation-regeneration change, rather than only in the generic transfer baseline.

## Starting Point

The evaluation suite has one typed critical-transfer fixture with dedicated assertion and rubric. Its current Promptfoo setup is single-fixture-specific, so adding a case requires a small harness generalization.

## Desired End State

One local command evaluates both fixtures with the fixed model matrix. Each fixture has a stable ID, matching structural assertion and rubric, and distinct report rows; production application behavior and CI remain unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Fixture corpus | Run both fixtures by default | Preserves the transfer baseline while broadening coverage. | Plan |
| Existing fixture | Preserve unchanged | Keeps the established generic regression baseline comparable. | Plan |
| Embedded diff | Source changes only | The review challenge must stand on implementation evidence, not intentionally weak tests. | Plan |
| Scenario | Offer edit and preparation regeneration | It mirrors real Astro, Supabase, service, and rendering patterns. | Research |
| Required findings | RLS bypass, destructive regeneration, stored XSS | They are distinct, high-impact, and directly grounded in existing safeguards. | Research |
| Future readiness | Stable IDs and aggregate report path | Enables later comparisons without adding tracking now. | Plan |

## Scope

**In scope:** shared fixture types/registry, one new fixture and rubric, fixture-aware assertions/configuration, package tests, aggregate result naming, and README updates.

**Out of scope:** production changes, CI, dashboards, tracking, model changes, arbitrary fixture selection, and modifications to the transfer fixture's meaning.

## Architecture / Approach

The fixture registry produces one Promptfoo test per case. A single variableized prompt avoids prompt/test cross-products, while each generated test supplies its own title, description, diff, expected-result assertion, and rubric.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fixture contract | Shared types, registry, and offer-regeneration diff | Accidentally introducing a fourth intended flaw |
| 2. Fixture-aware evaluation | Correct Promptfoo test/assertion/rubric pairing | Applying a rubric to the wrong diff |
| 3. Stable local operation | Aggregate result name and clear documentation | Mistaking local evals for CI or trend tracking |

**Prerequisites:** Existing `packages/code-review` dependencies; an `OPENROUTER_API_KEY` only for live verification.  
**Estimated effort:** ~2 focused sessions across 3 phases.

## Open Risks & Assumptions

- Live model output remains variable and incurs provider cost; deterministic package tests protect the harness only.
- The fixture must remain below the review input size limit while retaining enough multi-file context to be realistic.

## Success Criteria (Summary)

- Both fixtures run from the existing local evaluation command with fixture-specific grading.
- The new source-only diff has exactly three high-impact, project-grounded flaws.
- Package tests, root lint, and root build pass without adding paid CI work.
