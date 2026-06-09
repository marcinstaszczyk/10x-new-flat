# Extracted Viewing Preparation Implementation Plan

## Overview

Build S-03: a logged-in buyer can generate and review a persisted viewing-preparation result for one saved flat offer. The result uses the existing four-bucket extraction contract: answered questions, unanswered questions, doubtful facts, and unmapped facts.

This slice wires the completed extraction service into the saved-offer flow. It adds a buyer-owned persisted result, a protected extraction API route, a small Solid trigger island with pending/error states, and server-rendered review sections on the offer detail page.

## Current State Analysis

Saved offers are already protected and buyer-owned. `flat_offers` stores private pasted content with RLS, owner-scoped read/delete policies, and cascade deletion when the buyer account is deleted. The offer detail page loads one saved offer server-side and shows pasted content plus a delete action.

Buyer questions are already initialized lazily through `loadBuyerQuestionBase`, preserving category and open-question rows in positional order. The extraction contract is also complete: `extractOfferPreparation` accepts a saved offer plus buyer questions, calls OpenRouter server-side, validates the strict four-bucket schema, and returns typed failures without logging pasted content or raw model output.

### Key Discoveries

- Roadmap S-03 is the product north star: "Buyer can review extracted answers, unanswered questions, doubtful facts, and unmapped offer information" (`context/foundation/roadmap.md`).
- PRD guardrails require no invented facts, doubtful/unknown marking, no repeated questions for known facts unless doubt exists, and a useful result within 60 seconds (`context/foundation/prd.md`).
- The extraction contract deliberately skipped persistence and UI so this slice can decide lifecycle and UX (`context/changes/extraction-contract-check/plan.md`).
- `src/lib/services/extraction.ts` already provides typed success/failure results, metadata, input limits, and a 55-second timeout.
- Existing API routes use uppercase `POST`, `prerender = false`, zod input validation, `context.locals.user`, redirects or JSON-safe failure handling, and `createClient(context.request.headers, context.cookies)`.
- Existing protected pages are server-rendered Astro pages with small Solid islands only for interaction.
- New Supabase tables must have RLS plus explicit SELECT, INSERT, UPDATE, and DELETE policies for every accessing role.

## Desired End State

- A buyer can open a saved offer, click "Prepare viewing", see a pending state, and receive a reviewable result without leaving the offer context.
- The app stores at most one extraction result per offer. If a result already exists, rerun is blocked in this slice.
- The result is visible when the buyer revisits the offer, and it is deleted automatically when the offer is deleted.
- Answered and unanswered questions are rendered in the buyer question-base order with category grouping where possible.
- Buyer-facing errors are safe and specific; deeper diagnostics remain available from Cloudflare logs without exposing pasted content, prompts, API keys, or raw model output.

## What We're NOT Doing

- No extraction history, version comparison, manual replacement, or delete-result action.
- No background jobs, queues, polling, retries, streaming, or resumable extraction.
- No editing extracted answers, marking review status, notes, scoring, recommendation, or offer comparison.
- No link import, scraping, PDF/document parsing, or local heavy parsing.
- No mobile-specific redesign.
- No new general test runner.

## Implementation Approach

Add a persisted `offer_extraction_results` table with a unique `offer_id`, `buyer_id`, JSON result payload, provider metadata, and timestamps. Use RLS to let authenticated buyers read and insert their own completed results while denying direct client updates and deletes. The table references `flat_offers(id)` with `on delete cascade`, so deleting the offer remains the only result-deletion path in this slice.

Add a service layer that loads an offer, ensures no result exists, loads only open buyer questions for extraction, calls `extractOfferPreparation`, stores the success payload, and logs failures without DB changes. Add a protected API route under the offer namespace for the Solid trigger island. Render existing results server-side on `/offers/[id]`.

The extraction provider contract is intentionally adjusted in this slice: the model returns only answered questions, doubtful facts, and unmapped facts. The app completes the `unansweredQuestions` bucket after provider validation by adding every submitted open question that received neither a substantive answer nor a related doubtful fact. This keeps missing-question coverage deterministic, avoids asking the model to invent "not found" evidence, and prevents the same question from appearing in both `doubtfulFacts` and `unansweredQuestions`.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Persistence | Save latest result per offer | Buyer can revisit preparation output and deletion can cascade with the offer. |
| Result lifecycle | Block rerun when a result exists | Keeps one source of truth and avoids replacement/version UI in the first S-03 slice. |
| Trigger | Button on offer detail | Fits current saved-offer flow and avoids surprise provider cost. |
| Long-running UX | Solid island fetch with pending state | Gives clear feedback during the external call without adding background infrastructure. |
| Layout | Sections on offer detail | Keeps source material and preparation output in one context. |
| Question ordering | Preserve category grouping where possible | Matches the PRD goal of natural viewing-conversation order. |
| Unanswered questions | Complete locally after provider validation | Guarantees every open question with no answer or related doubtful fact remains visible without requiring model-generated missing-question rows. |
| Failure display | Safe specific statuses plus logged diagnostics | Helps buyers and operators understand failures without leaking sensitive content or storing failed results. |
| Verification | Migration tests, lint/build, manual UI flow | Covers privacy, cascade behavior, and the core user path. |

## Phase 1: Persist Buyer-Owned Extraction Results

### Overview

Create the database contract for one extraction result per saved offer, including ownership, cascade deletion, RLS, generated/status metadata, and type updates.

### Changes Required

#### 1. Result persistence migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_create_offer_extraction_results.sql`

**Intent**: Persist one buyer-owned preparation result per offer and make offer deletion remove extracted content.

**Contract**:

- Create `public.offer_extraction_results`.
- Columns:
  - `id uuid primary key default gen_random_uuid()`
  - `offer_id uuid not null references public.flat_offers(id) on delete cascade`
  - `buyer_id uuid not null default auth.uid() references auth.users(id) on delete cascade`
  - `status text not null` constrained to `completed`
  - `result jsonb not null`
  - `model text not null`
  - `latency_ms integer not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Add constraints:
  - unique `offer_id`
  - `latency_ms >= 0`
  - completed rows require `result is not null`
  - `buyer_id` must match the referenced offer owner. Use a trigger or security-definer insert function if a cross-table check cannot be expressed safely as a check constraint.
- Add owner-scoped indexes for offer lookup and buyer ordering.
- Add an updated-at trigger using the existing trigger style.
- Enable RLS.
- Define explicit policies for authenticated:
  - SELECT own rows
  - INSERT own rows for own offers
  - UPDATE denied
  - DELETE denied
- Revoke broad table access from public/anon/authenticated.
- Grant only the minimum table/column privileges needed by the server route.

#### 2. Database contract test

**File**: `supabase/tests/database/offer_extraction_results_contract.test.sql`

**Intent**: Prove ownership, one-result-per-offer, cascade deletion, and failure/success shape constraints.

**Contract**:

- Verify table, expected columns, indexes, constraints, trigger, RLS, policies, and grants.
- Verify anon cannot read, insert, update, or delete.
- Verify buyer A can read only buyer A results.
- Verify buyer A can insert one result for buyer A offer.
- Verify buyer A cannot insert for buyer B offer or spoof `buyer_id`.
- Verify duplicate result for the same offer is rejected.
- Verify direct updates and direct deletes are denied.
- Verify deleting a flat offer cascades to its extraction result.
- Verify deleting buyer A does not affect buyer B results.
- Verify completed row invariants reject malformed rows.

#### 3. TypeScript database types and app DTOs

**File**: `src/types.ts`

**Intent**: Keep Supabase access and UI rendering typed.

**Contract**:

- Add `offer_extraction_results` to `Database.public.Tables`.
- Add app-facing row types for a persisted extraction result.
- Keep the existing storage-agnostic `ExtractionResult` contract unchanged.
- Represent persisted status as a narrow union, not an arbitrary string.

### Success Criteria

#### Automated Verification

- Supabase database test for `offer_extraction_results` passes.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review the migration and confirm RLS policies cover SELECT, INSERT, UPDATE, and DELETE explicitly.
- Review cascade behavior and confirm deleting an offer deletes its extraction result.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Add Extraction Result Services and API

### Overview

Add server-side operations that load the current result, generate a result once, persist success safely, log failures without DB changes, and reject reruns when a result already exists.

### Changes Required

#### 1. Result persistence service

**File**: `src/lib/services/offer-extraction-results.ts`

**Intent**: Isolate database reads/writes and status mapping from pages and API routes.

**Contract**:

- Export `loadOfferExtractionResult(client, offerId)`.
- Export `createOfferExtractionResult(client, input)`.
- Export a small mapper from Supabase row shape to app-facing shape.
- Return typed `{ ok: true } | { ok: false }` results consistent with existing services.
- Do not accept client-supplied `buyer_id`.
- Store only successful extraction results. Do not store diagnostics, pasted content, prompts, raw provider response, or API keys.

#### 2. Orchestration service

**File**: `src/lib/services/offer-preparation.ts`

**Intent**: Own the end-to-end prepare action so the API route stays thin.

**Contract**:

- Export `prepareOfferViewing(client, offerId)`.
- Load the saved offer through existing offer ownership rules.
- Return `not_found` when the offer is unavailable.
- Load existing extraction result first; return `already_exists` without calling OpenRouter when present.
- Load buyer question base and pass only `open_question` rows to `extractOfferPreparation`.
- Preserve question categories for rendering by storing/rendering against the full current question base, not by sending category rows to the model.
- Call `extractOfferPreparation` with the existing service defaults.
- Persist successful extraction result as `completed`.
- For typed extraction failures, do not write an extraction-result row.
- Log a Cloudflare-safe structured message for failures and blocked reruns:
  - include offer ID, failure reason/status, model, and latency
  - exclude pasted content, prompt, raw model output, API key, and buyer email

#### 3. Protected prepare API route

**File**: `src/pages/api/offers/[id]/prepare.ts`

**Intent**: Let the offer detail page start extraction without a full-page hanging POST.

**Contract**:

- Export `const prerender = false`.
- Export uppercase `POST`.
- Require `context.locals.user`; unauthenticated returns 401 JSON.
- Validate `context.params.id` with zod UUID.
- Create Supabase client through `createClient(context.request.headers, context.cookies)`.
- Call `prepareOfferViewing`.
- Return JSON statuses:
  - `201` for created completed persisted result
  - `409` for already existing result
  - `404` for offer not found
  - `400` for invalid ID
  - `500` for storage/configuration failure
- Do not return pasted content, prompts, API key, raw provider response, or full diagnostics.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review services and confirm OpenRouter is never called when a persisted result already exists.
- Review logs and API responses for sensitive-data exclusion.
- Review failure handling and confirm failures leave no extraction-result row while Cloudflare logs retain safe diagnostics.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Render and Trigger Preparation on Offer Detail

### Overview

Update the saved-offer detail page to show the existing preparation result and add a small interactive button for the first generation.

### Changes Required

#### 1. Preparation trigger island

**File**: `src/components/offers/PrepareViewingButton.tsx`

**Intent**: Give the buyer immediate feedback while the external extraction call runs.

**Contract**:

- Props include `offerId` and whether a result already exists.
- If a result exists, render a disabled state explaining that preparation already exists.
- On click, POST to `/api/offers/{offerId}/prepare`.
- Disable the button while pending.
- Show a pending message suitable for a long wait.
- On success, reload the current page or update local state enough to show the persisted result.
- On `409`, reload or show an already-prepared status.
- Show safe specific error labels for:
  - too large
  - timeout
  - provider issue
  - invalid output
  - missing configuration
  - generic storage/unexpected failure

#### 2. Result rendering components

**Files**:

- `src/components/offers/OfferPreparationResult.astro`
- Optional small subcomponents under `src/components/offers/`

**Intent**: Render the persisted four-bucket result in a compact, reviewable structure.

**Contract**:

- Render four sections on the offer detail page:
  - Answered questions
  - Unanswered questions
  - Doubtful facts
  - Unmapped facts
- Use stable counts in section headings.
- For answered and unanswered question rows, preserve category grouping where possible by matching result question IDs against the current full buyer question base.
- Keep unmatched result rows visible in an "Uncategorized" group instead of dropping them.
- Show answer, evidence, confidence, and reason fields where relevant.
- For failed API responses, show a safe specific status and leave the page ready for another attempt because no result was persisted.
- Use the existing restrained dashboard style: full-width content, small cards for repeated rows, no nested cards.

#### 3. Offer detail page integration

**File**: `src/pages/offers/[id].astro`

**Intent**: Make the saved-offer page the complete viewing-preparation workspace.

**Contract**:

- Load the saved offer as today.
- Load buyer question base and the persisted extraction result when an offer exists.
- Preserve existing create/delete success and error banners.
- Render source offer details and pasted content.
- Render `PrepareViewingButton` near the offer header when no result exists.
- Render `OfferPreparationResult` below the source content when a result exists.
- Render load errors for result/question-base failure without hiding the saved offer source.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- With no result, `/offers/:id` shows a usable "Prepare viewing" action.
- Clicking the action shows a pending state and does not allow duplicate clicks.
- A completed result appears after generation and remains visible after page reload.
- A second extraction attempt is blocked when a result already exists.
- Answered and unanswered questions render in category order where matching question IDs exist.
- Failed attempts show safe user-facing status only and do not create a persisted result.
- Deleting the offer removes the saved offer and its preparation result.

**Implementation Note**: After completing this phase and all automated verification passes, pause for final manual confirmation before closing the change.

---

## Testing Strategy

### Database Tests

- Add `supabase/tests/database/offer_extraction_results_contract.test.sql`.
- Run the new test directly with Supabase's database test command.
- Keep existing flat-offer and buyer-question tests unchanged unless the migration requires shared setup changes.

### Type and Build Gates

- Run `pnpm run lint`.
- Run `pnpm run build`.
- Build must pass without OpenRouter configuration.

### Manual UI Testing

1. Sign in and create a saved offer with pasted content.
2. Open the offer detail page and click "Prepare viewing".
3. Confirm pending state, completed result rendering, and persistence after reload.
4. Try to run extraction again and confirm it is blocked.
5. Delete the offer and confirm the result is gone through cascade behavior.
6. Temporarily simulate provider/configuration failure and confirm safe UI, safe logs, and no extraction-result row.

## Performance Considerations

- Extraction remains one external OpenRouter request plus light validation.
- The existing 55-second service timeout stays below the PRD's 60-second target.
- The trigger island must prevent duplicate clicks while the request is pending.
- Blocking reruns after successful persistence prevents accidental repeated provider calls.
- Persisted JSON is small and bounded by the existing extraction schema limits.

## Migration Notes

- Add one new table and database test.
- Rollback requires dropping `offer_extraction_results` and its trigger/function/indexes/policies.
- Because the result table cascades from `flat_offers`, deleting offers during development will also delete results.
- No existing saved-offer rows require backfill; they simply start with no preparation result.

## References

- Change identity: `context/changes/extracted-viewing-preparation/change.md`
- Roadmap S-03: `context/foundation/roadmap.md`
- PRD extraction requirements: `context/foundation/prd.md`
- Prior extraction contract: `context/changes/extraction-contract-check/plan.md`
- Extraction service: `src/lib/services/extraction.ts`
- Extraction provider boundary: `src/lib/services/extraction-provider.ts`
- Extraction schema and limits: `src/lib/services/extraction-contract.ts`
- Saved offer service: `src/lib/services/offers.ts`
- Question service: `src/lib/services/questions.ts`
- Offer detail page: `src/pages/offers/[id].astro`
- Flat offers migration/test: `supabase/migrations/20260605100000_create_flat_offers.sql`, `supabase/tests/database/flat_offers_contract.test.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Persist Buyer-Owned Extraction Results

#### Automated

- [x] 1.1 Supabase database test for `offer_extraction_results` passes — 2e40206
- [x] 1.2 `pnpm run lint` passes — 2e40206
- [x] 1.3 `pnpm run build` passes — 2e40206

#### Manual

- [x] 1.4 Review the migration and confirm RLS policies cover SELECT, INSERT, UPDATE, and DELETE explicitly — 2e40206
- [x] 1.5 Review cascade behavior and confirm deleting an offer deletes its extraction result — 2e40206

### Phase 2: Add Extraction Result Services and API

#### Automated

- [x] 2.1 `pnpm run lint` passes. — 73325e5
- [x] 2.2 `pnpm run build` passes. — 73325e5

#### Manual

- [x] 2.3 Review services and confirm OpenRouter is never called when a persisted result already exists. — 73325e5
- [x] 2.4 Review logs and API responses for sensitive-data exclusion. — 73325e5
- [x] 2.5 Review failure handling and confirm failures leave no extraction-result row while Cloudflare logs retain safe diagnostics. — 73325e5

### Phase 3: Render and Trigger Preparation on Offer Detail

#### Automated

- [x] 3.1 `pnpm run lint` passes. — fdcb999
- [x] 3.2 `pnpm run build` passes. — fdcb999

#### Manual

- [x] 3.3 With no result, `/offers/:id` shows a usable "Prepare viewing" action. — fdcb999
- [x] 3.4 Clicking the action shows a pending state and does not allow duplicate clicks. — fdcb999
- [x] 3.5 A completed result appears after generation and remains visible after page reload. — fdcb999
- [x] 3.6 A second extraction attempt is blocked when a result already exists. — fdcb999
- [x] 3.7 Answered and unanswered questions render in category order where matching question IDs exist. — fdcb999
- [x] 3.8 Failed attempts show safe user-facing status only and do not create a persisted result. — fdcb999
- [x] 3.9 Deleting the offer removes the saved offer and its preparation result. — fdcb999
