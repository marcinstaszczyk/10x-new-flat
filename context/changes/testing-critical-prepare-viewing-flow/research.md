---
date: 2026-06-09T20:08:33+02:00
researcher: Codex
git_commit: 68587e159d9cd7ceed1fe855703d3b1094be6b8a
branch: main
repository: marcinstaszczyk/10xNewFlat
topic: "testing-critical-prepare-viewing-flow"
tags: [research, codebase, testing, offers, extraction, prepare-viewing]
status: complete
last_updated: 2026-06-09
last_updated_by: Codex
---

# Research: testing-critical-prepare-viewing-flow

**Date**: 2026-06-09T20:08:33+02:00
**Researcher**: Codex
**Git Commit**: 68587e159d9cd7ceed1fe855703d3b1094be6b8a
**Branch**: main
**Repository**: marcinstaszczyk/10xNewFlat

## Research Question

Ground rollout Phase 1, "Critical prepare-viewing flow", for tests covering:

- Risk #1: buyer cannot complete the primary prepare-viewing flow after pasting a long offer.
- Risk #4: extraction output looks complete but loses answered, unanswered, doubtful, or unmapped distinctions.

## Summary

The primary flow is server-rendered around `/offers/[id]`. A buyer saves pasted offer content, opens the saved offer detail, clicks a Solid island button, posts to `/api/offers/[id]/prepare`, and reloads the page after a result is persisted. The service path loads the saved offer, rejects duplicate preparation, loads the buyer question base, sends only `open_question` rows plus the pasted offer content to extraction, validates the result, stores one completed extraction result, and renders four buckets on reload.

The main testing risk is not only provider schema shape. OpenRouter is asked to return `answeredQuestions`, `doubtfulFacts`, and `unmappedFacts`; `unansweredQuestions` is synthesized locally from submitted questions that are neither substantively answered nor tied to a doubtful fact. Phase 1 tests should therefore exercise provider parsing plus local completion rules without a live LLM on every run, and add one browser/manual smoke that proves persisted four-bucket data renders on the offer detail page.

## Detailed Findings

### Primary Prepare-Viewing Flow

- The user entry path is authenticated saved offers: dashboard links to `/offers`, the offer list loads rows server-side, and each row links to `/offers/{id}` ([dashboard.astro:28](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/dashboard.astro#L28), [offers/index.astro:8](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/offers/index.astro#L8), [OfferList.astro:28](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferList.astro#L28)).
- Saved offer creation posts title, source URL, and pasted content to `/api/offers/create`, then redirects to the detail page on success ([new.astro:41](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/offers/new.astro#L41), [create.ts:50](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/api/offers/create.ts#L50)).
- The offer detail page loads the saved offer, existing extraction result, and buyer question base server-side, then renders pasted content, prepare/delete controls, and any persisted result ([offers/[id].astro:14](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/offers/%5Bid%5D.astro#L14), [offers/[id].astro:21](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/offers/%5Bid%5D.astro#L21), [offers/[id].astro:111](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/offers/%5Bid%5D.astro#L111), [offers/[id].astro:130](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/offers/%5Bid%5D.astro#L130), [offers/[id].astro:153](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/offers/%5Bid%5D.astro#L153)).
- `PrepareViewingButton` blocks repeat clicks when pending or when a result already exists, POSTs to `/api/offers/{id}/prepare`, reloads on `201` or `409`, and maps other JSON statuses to user-visible error copy ([PrepareViewingButton.tsx:37](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/PrepareViewingButton.tsx#L37), [PrepareViewingButton.tsx:47](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/PrepareViewingButton.tsx#L47), [PrepareViewingButton.tsx:50](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/PrepareViewingButton.tsx#L50), [PrepareViewingButton.tsx:76](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/PrepareViewingButton.tsx#L76)).

### API And Service Boundary

- The prepare API exports `prerender = false`, validates auth, validates UUID params with zod, creates a Supabase request client, delegates to `prepareOfferViewing`, and returns JSON statuses ([prepare.ts:6](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/api/offers/%5Bid%5D/prepare.ts#L6), [prepare.ts:14](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/api/offers/%5Bid%5D/prepare.ts#L14), [prepare.ts:19](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/api/offers/%5Bid%5D/prepare.ts#L19), [prepare.ts:24](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/api/offers/%5Bid%5D/prepare.ts#L24), [prepare.ts:29](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/api/offers/%5Bid%5D/prepare.ts#L29)).
- Failure statuses map to `404` not found, `409` already exists, `413` input too large, `504` timeout, `502` provider/invalid output, and `500` configuration/question base/storage ([prepare.ts:43](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/pages/api/offers/%5Bid%5D/prepare.ts#L43)).
- `prepareOfferViewing` is the core flow seam: load saved offer, load existing result, reject duplicate, load buyer questions, call extraction with title/content and open questions, persist successful result ([offer-preparation.ts:22](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L22), [offer-preparation.ts:26](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L26), [offer-preparation.ts:35](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L35), [offer-preparation.ts:52](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L52), [offer-preparation.ts:57](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L57), [offer-preparation.ts:73](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L73)).
- Failures are not persisted; extraction failure returns the provider/configuration/input status and storage failure returns `storage` or `already_exists` ([offer-preparation.ts:68](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L68), [offer-preparation.ts:80](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-preparation.ts#L80)).

### Persisted State

- `flat_offers` stores `title`, optional `source_url`, `pasted_content`, and timestamps; offer reads are session/RLS-scoped rather than app-filtered by `buyer_id` ([offers.ts:87](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offers.ts#L87), [20260605100000_create_flat_offers.sql:1](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/supabase/migrations/20260605100000_create_flat_offers.sql#L1), [20260605100000_create_flat_offers.sql:41](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/supabase/migrations/20260605100000_create_flat_offers.sql#L41)).
- `offer_extraction_results` stores one completed row per offer with JSON result, model, latency, owner trigger, RLS, and cascade deletion through `flat_offers` ([20260609143000_create_offer_extraction_results.sql:1](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/supabase/migrations/20260609143000_create_offer_extraction_results.sql#L1), [20260609143000_create_offer_extraction_results.sql:19](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/supabase/migrations/20260609143000_create_offer_extraction_results.sql#L19), [20260609143000_create_offer_extraction_results.sql:31](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/supabase/migrations/20260609143000_create_offer_extraction_results.sql#L31), [20260609143000_create_offer_extraction_results.sql:77](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/supabase/migrations/20260609143000_create_offer_extraction_results.sql#L77)).
- Application writes validate the full four-bucket `completedExtractionResultSchema`; reads only check all four bucket keys are arrays before rendering ([offer-extraction-results.ts:67](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-extraction-results.ts#L67), [offer-extraction-results.ts:94](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/offer-extraction-results.ts#L94)).
- The database bucket constraint is shallow but catches missing or non-array bucket keys ([20260609171000_enforce_offer_extraction_result_buckets.sql:1](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql#L1)).

### Extraction Contract And Completion Rules

- The app-facing TypeScript result is four buckets: answered, unanswered, doubtful, and unmapped ([types.ts:63](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/types.ts#L63)).
- The provider-facing schema is three buckets. `unansweredQuestions` is intentionally absent from `extractionResultSchema` and from the OpenRouter JSON schema ([extraction-contract.ts:58](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-contract.ts#L58), [extraction-contract.ts:138](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-contract.ts#L138)).
- The prompt tells the model to omit unanswered questions, put suspicious or uncertain values in `doubtfulFacts`, and put useful unmatched facts in `unmappedFacts` ([extraction-contract.ts:100](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-contract.ts#L100)).
- Raw parsed provider content gets `unansweredQuestions: []`; full completion happens only when the provider path has the submitted question list ([extraction-provider.ts:78](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-provider.ts#L78), [extraction-provider.ts:128](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-provider.ts#L128)).
- Completion filters non-substantive answers, treats answered question IDs and `doubtfulFacts.relatedQuestionId` as mapped, then puts the remaining submitted questions into `unansweredQuestions` ([extraction-provider.ts:149](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-provider.ts#L149), [extraction-provider.ts:170](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-provider.ts#L170)).
- Extraction has deterministic guardrails: 100,000 offer characters, 200 questions, 55 second timeout, 8,000 max output tokens, and typed configuration/input/provider/timeout/invalid-output failures ([extraction-contract.ts:4](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-contract.ts#L4), [extraction-contract.ts:88](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-contract.ts#L88), [extraction.ts:39](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction.ts#L39), [extraction-provider.ts:48](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-provider.ts#L48), [extraction-provider.ts:179](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/extraction-provider.ts#L179)).

### Review Rendering

- The result component groups answered and unanswered questions by the current question base, sorting by question position and falling back to an uncategorized group if metadata is missing ([OfferPreparationResult.astro:17](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L17), [OfferPreparationResult.astro:30](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L30), [OfferPreparationResult.astro:49](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L49), [OfferPreparationResult.astro:53](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L53)).
- The four user-visible result sections are answered, unanswered, doubtful facts, and unmapped facts; each section displays the bucket count ([OfferPreparationResult.astro:94](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L94), [OfferPreparationResult.astro:125](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L125), [OfferPreparationResult.astro:148](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L148), [OfferPreparationResult.astro:170](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/components/offers/OfferPreparationResult.astro#L170)).

### Auth And Ownership Assumptions

- Middleware resolves the user for every request and protects `/dashboard`, `/offers`, `/api/questions`, and `/api/offers`; unauthenticated requests normally redirect before the prepare handler runs ([middleware.ts:4](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/middleware.ts#L4), [middleware.ts:18](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/middleware.ts#L18)).
- `loadBuyerQuestionBase` always calls `ensure_buyer_question_base`, then reads buyer questions ordered by `position` ([questions.ts:22](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/questions.ts#L22), [questions.ts:31](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/src/lib/services/questions.ts#L31)).

## Code References

- `src/pages/offers/[id].astro:14` - saved offer detail loads the offer.
- `src/pages/offers/[id].astro:21` - detail loads extraction result and question base.
- `src/components/offers/PrepareViewingButton.tsx:37` - client-side duplicate/pending guard.
- `src/pages/api/offers/[id]/prepare.ts:14` - prepare API auth/validation entry.
- `src/lib/services/offer-preparation.ts:22` - core prepare-viewing orchestration.
- `src/lib/services/extraction-contract.ts:58` - provider result schema excludes unanswered questions.
- `src/lib/services/extraction-provider.ts:149` - local unanswered-question completion.
- `src/lib/services/offer-extraction-results.ts:67` - full four-bucket validation before storage.
- `src/components/offers/OfferPreparationResult.astro:94` - rendered answered bucket.
- `src/components/offers/OfferPreparationResult.astro:125` - rendered unanswered bucket.
- `src/components/offers/OfferPreparationResult.astro:148` - rendered doubtful bucket.
- `src/components/offers/OfferPreparationResult.astro:170` - rendered unmapped bucket.
- `supabase/migrations/20260609143000_create_offer_extraction_results.sql:1` - persisted extraction result table.
- `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:1` - database bucket presence constraint.

## Architecture Insights

- The cheapest deterministic bucket test seam is `callOpenRouterExtraction` with an injected fake `fetcher`. It exercises request parsing, provider response parsing, local unanswered completion, non-answer filtering, and typed failure behavior without a live LLM.
- The main service seam is `prepareOfferViewing`, but it currently imports `extractOfferPreparation` directly. Cheap isolated tests would need module mocking or a small future injection seam; otherwise the practical path is local Supabase integration plus a controlled provider boundary.
- The result rendering helpers are private to an Astro component. Direct unit testing of grouping/sorting is not currently cheap. A seeded browser/manual smoke that verifies bucket counts and section labels on `/offers/[id]` gives better signal for Phase 1.
- Existing database contract coverage already protects ownership, uniqueness, bucket presence, cross-buyer denial, and cascade delete for `offer_extraction_results`; Phase 1 should avoid duplicating that coverage except where app integration requires setup.
- A saved offer can be larger than the extraction limit because creation only requires non-empty pasted content, while preparation rejects content above 100,000 characters. This is useful for a focused API/service negative case but not the primary long-offer success case.

## Historical Context

- The PRD requires no invented offer facts, explicit doubtful/unknown marking, and no repeated known facts unless doubt exists ([prd.md:47](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/foundation/prd.md#L47), [prd.md:100](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/foundation/prd.md#L100)).
- The test plan Phase 1 covers risks #1 and #4 and calls for integration, e2e/manual smoke, and on-demand contract checking ([test-plan.md:54](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/foundation/test-plan.md#L54), [test-plan.md:57](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/foundation/test-plan.md#L57)).
- F-02 defined the extraction contract and kept it as contract-only: no persistence and no UI at that stage ([context/archive/2026-06-08-extraction-contract-check/plan.md:26](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-08-extraction-contract-check/plan.md#L26), [context/archive/2026-06-08-extraction-contract-check/plan.md:34](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-08-extraction-contract-check/plan.md#L34)).
- F-02 review required the live contract check to share the service provider path; that was fixed by moving provider parsing into `extraction-provider.ts` ([context/archive/2026-06-08-extraction-contract-check/reviews/impl-review.md:28](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-08-extraction-contract-check/reviews/impl-review.md#L28), [context/archive/2026-06-08-extraction-contract-check/reviews/impl-review.md:35](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-08-extraction-contract-check/reviews/impl-review.md#L35)).
- S-03 added one persisted result per offer, manual triggering from the offer detail page, cascade deletion with the offer, and no persistence for failed preparation attempts ([context/archive/2026-06-09-extracted-viewing-preparation/plan.md:27](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-09-extracted-viewing-preparation/plan.md#L27), [context/archive/2026-06-09-extracted-viewing-preparation/plan.md:44](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-09-extracted-viewing-preparation/plan.md#L44), [context/archive/2026-06-09-extracted-viewing-preparation/plan.md:195](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-09-extracted-viewing-preparation/plan.md#L195)).
- S-03 implementation review called out the important contract change: unanswered questions are synthesized locally after provider validation ([context/archive/2026-06-09-extracted-viewing-preparation/reviews/impl-review.md:42](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-09-extracted-viewing-preparation/reviews/impl-review.md#L42)).
- The S-03 live extraction check was skipped because `OPENROUTER_API_KEY` was not set, reinforcing that live provider checks should stay on-demand ([context/archive/2026-06-09-extracted-viewing-preparation/reviews/impl-review.md:57](https://github.com/marcinstaszczyk/10xNewFlat/blob/68587e159d9cd7ceed1fe855703d3b1094be6b8a/context/archive/2026-06-09-extracted-viewing-preparation/reviews/impl-review.md#L57)).

## Related Research

No prior `research.md` artifacts were found under `context/changes/**` or `context/archive/**`.

Relevant non-research artifacts:

- `context/foundation/test-plan.md`
- `context/archive/2026-06-08-extraction-contract-check/plan.md`
- `context/archive/2026-06-08-extraction-contract-check/reviews/impl-review.md`
- `context/archive/2026-06-09-extracted-viewing-preparation/plan.md`
- `context/archive/2026-06-09-extracted-viewing-preparation/reviews/impl-review.md`

## Open Questions

- Should Phase 1 add a small extractor injection seam to `prepareOfferViewing`, or should the first integration tests use module mocking around the provider boundary?
- Should the browser/manual smoke seed a persisted four-bucket result directly, or drive the button against a controlled local provider response?
- Should the long-offer success fixture stay below 100,000 characters while still being representative, with a separate `input_too_large` negative case above the limit?
