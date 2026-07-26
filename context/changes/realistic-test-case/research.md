---
date: 2026-07-26T19:42:59+02:00
researcher: Codex
git_commit: 446db5b7e43f457765d4974eb7c3147c5811515f
branch: main
repository: 10x-new-flat
topic: "Add a realistic project-based test case for code-review prompt and model evaluations"
tags: [research, code-review, evals, supabase, astro, solidjs]
status: complete
last_updated: 2026-07-26
last_updated_by: Codex
---

# Research: realistic code-review evaluation case

**Date**: 2026-07-26T19:42:59+02:00  
**Researcher**: Codex  
**Git Commit**: 446db5b7e43f457765d4974eb7c3147c5811515f  
**Branch**: main  
**Repository**: 10x-new-flat

## Research Question

Add a complex, project-based evaluation diff for `packages/code-review` that contains exactly three impactful flaws.

## Summary

Add a second fixture for a plausible feature: allow a buyer to edit a saved offer and regenerate its viewing preparation. The diff should span an Astro UI, API route, service, Supabase migration, and narrow happy-path tests. Seed these three required findings:

1. A broken RLS `UPDATE` policy permits authenticated users to modify another buyer's offer.
2. Regeneration deletes the existing preparation before the replacement succeeds, losing valid data on an extractor failure.
3. The UI renders persisted extractor output with `set:html`, creating stored XSS.

This is materially more realistic than the existing generic account-transfer fixture while retaining the established exact-three-findings evaluation contract.

## Detailed Findings

### Evaluation fixture contract

- [`packages/code-review/evals/fixtures/critical-transfer.ts:3`](../../../packages/code-review/evals/fixtures/critical-transfer.ts#L3) defines the reusable pattern: typed `ReviewInput`, expected failed verdict, three score ceilings, and three ordered, causally described findings.
- [`packages/code-review/evals/fixtures/critical-transfer.test.ts:6`](../../../packages/code-review/evals/fixtures/critical-transfer.test.ts#L6) locks exactly three IDs, expected scoring, and only the deliberate diff markers.
- [`packages/code-review/evals/promptfooconfig.ts:1`](../../../packages/code-review/evals/promptfooconfig.ts#L1) and [`evals/assertions/review-result.ts:6`](../../../packages/code-review/evals/assertions/review-result.ts#L6) are fixture-specific today. A second fixture needs generalized assertion/rubric/config selection or a separate suite; adding another prompt to the current config would apply the transfer rubric incorrectly.
- [`packages/code-review/review-contract.ts:9`](../../../packages/code-review/review-contract.ts#L9) caps the diff at 200 KiB, leaving ample room for a multi-file but focused fixture.

### Project-grounded scenario

The chosen feature extends genuine ownership, preparation, and rendering flows:

- Middleware resolves the authenticated user and protects offer API paths in [`src/middleware.ts:4`](../../../src/middleware.ts#L4).
- The existing preparation route validates the offer ID and uses `context.locals.user` in [`src/pages/api/offers/[id]/prepare.ts:16`](../../../src/pages/api/offers/[id]/prepare.ts#L16).
- [`src/lib/services/offer-preparation.ts:44`](../../../src/lib/services/offer-preparation.ts#L44) prevents reruns when a result already exists, calls the extractor at line 66, and persists after it completes at line 82.
- Existing offer RLS is ownership-based and intentionally excludes updates in [`supabase/migrations/20260605100000_create_flat_offers.sql:41`](../../../supabase/migrations/20260605100000_create_flat_offers.sql#L41).
- Existing extraction results are immutable, with no delete policy, in [`supabase/migrations/20260609143000_create_offer_extraction_results.sql:99`](../../../supabase/migrations/20260609143000_create_offer_extraction_results.sql#L99).
- Preparation output is safely interpolated today in [`src/components/offers/OfferPreparationResult.astro:102`](../../../src/components/offers/OfferPreparationResult.astro#L102).

### Required flaws

1. **Cross-tenant offer update through RLS.** The fixture migration should replace the deny-update stance with `FOR UPDATE USING (true) WITH CHECK ((select auth.uid()) = buyer_id)` and grant selected update columns. The feature service can then update by offer ID without an obvious application-level error. `WITH CHECK` constrains only the resulting row, while `USING (true)` exposes every row as an update target.
2. **Destructive regeneration order.** The service should delete the current extraction result, then call the external extractor, then insert its replacement. Any timeout, provider error, validation error, or insert failure irreversibly removes the previously valid preparation.
3. **Stored XSS from extractor output.** The UI should replace safe interpolation for evidence text with `set:html={item.evidenceText}` under a plausible rich-evidence rendering change. Offer text and model output are persisted and untrusted; malicious HTML then executes in a signed-in buyer's origin.

The supporting test diff should exercise only owner edit, successful regeneration, and normal evidence display. It must omit a cross-user update attempt, failed regeneration preservation, and HTML payload coverage so each defect remains reviewable rather than contradicted by tests.

## Architecture Insights

The fixture should follow the existing project's server-first design: Astro route, request-scoped Supabase client, service operation, migration, and Astro rendering. It should not invent a generic banking domain or client-side authentication pattern. The three risks span authorization, data integrity, and browser security without overlapping causal explanations.

## Historical Context

- [`context/changes/code-review-evals/plan.md:37`](../code-review-evals/plan.md#L37) established the current explicit fixture contract and required three material findings.
- [`context/changes/code-review-evals/reviews/impl-review.md:20`](../code-review-evals/reviews/impl-review.md#L20) records a prior canonical-output blind spot, reinforcing the value of deterministic fixture contracts.
- [`context/archive/2026-06-04-buyer-data-ownership-contract/reviews/impl-review.md:38`](../../archive/2026-06-04-buyer-data-ownership-contract/reviews/impl-review.md#L38) documents the project's sensitivity to unprotected ownership/provenance mutations.
- The generic transfer fixture should remain intact; the request is best met by a second project-real case rather than replacing the baseline.

## Related Research

- [`context/changes/code-review-evals/research.md`](../code-review-evals/research.md)
- [`context/changes/ci-cd-code-review-verification-and-improvement/research.md`](../ci-cd-code-review-verification-and-improvement/research.md)

## Open Questions

- Should both fixtures run in one matrix and receive fixture-specific assertion/rubric inputs, or should the new case be separately selectable to control local evaluation cost?
