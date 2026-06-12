---
title: Viewing Preparation Invariant Aggregate Refactor
created: 2026-06-12
type: refactor-plan
---

# Viewing Preparation Invariant Aggregate Refactor

## Step 0 - Context

Product goal: the buyer prepares a useful flat-viewing question list quickly. The PRD success criteria say the first flat should take less than 30 minutes and later flats less than 10 minutes (`context/foundation/prd.md:38`, `context/foundation/prd.md:39`). The core guardrails are trust rules: the product must not invent offer facts, uncertain values must be marked unknown or doubtful, and facts already present in the offer must not be repeated unless doubt exists (`context/foundation/prd.md:47`, `context/foundation/prd.md:48`).

Business logic: extracted offer information is mapped against a buyer-specific question base, matched facts become answered, unanswered questions are surfaced, and uncertain or unmapped information is flagged for review (`context/foundation/prd.md:100`). The output buckets are answered question pairs, unanswered questions, doubtful facts, and unmapped offer information (`context/foundation/prd.md:104`).

Stack and business-logic layers:

| Layer | Evidence | Domain role |
|---|---|---|
| Astro SSR / routes | Astro v6 server-first framework (`README.md:9`) and `output: "server"` (`astro.config.mjs:12`) | Protected pages and API entry points. |
| Solid islands | SolidJS is used for interactive components (`README.md:10`) | Button state, delete/reset interactions. |
| API routes | `POST` route validates offer id and calls `prepareOfferViewing` (`src/pages/api/offers/[id]/prepare.ts:16`, `src/pages/api/offers/[id]/prepare.ts:31`) | Input parsing and HTTP mapping. |
| Service/application | `prepareOfferViewing` loads offer, result, question base, extractor, and persistence (`src/lib/services/offer-preparation.ts:29`, `src/lib/services/offer-preparation.ts:82`) | Current orchestration boundary. |
| Extraction contract/provider | zod schemas and prompt rules define extraction buckets (`src/lib/services/extraction-contract.ts:49`, `src/lib/services/extraction-contract.ts:100`) | Current semantic contract with model. |
| Persistence | Supabase stores offers, questions, and extraction results (`README.md:13`) | RLS, ownership, uniqueness, JSON bucket checks. |
| Tests/contracts | `test:app`, `test:e2e`, and database tests exist (`package.json:10`, `package.json:11`) | Refactor should be test-first for service/domain and DB contracts. |

There is no explicit domain aggregate today. The invariant is distributed across routes, services, prompt text, UI state, zod schemas, Supabase constraints, RLS policies, and tests.

## Step 1 - Business Invariants

| Invariant | Source | Current enforcement |
|---|---|---|
| Buyer offer content is private to the logged-in buyer. | PRD says pasted offer content is visible only to the logged-in buyer (`context/foundation/prd.md:94`). | `flat_offers` has `buyer_id default auth.uid()` (`supabase/migrations/20260605100000_create_flat_offers.sql:3`) and owner RLS (`supabase/migrations/20260605100000_create_flat_offers.sql:43`, `supabase/migrations/20260605100000_create_flat_offers.sql:62`). |
| A saved offer requires a nonblank title and pasted content; source URL is optional but nonblank if present. | Saved offers have title, pasted content, and optional source URL (`README.md:119`). | API zod requires title/content and URL shape (`src/pages/api/offers/create.ts:8`, `src/pages/api/offers/create.ts:14`, `src/pages/api/offers/create.ts:15`); DB enforces nonblank values (`supabase/migrations/20260605100000_create_flat_offers.sql:5`, `supabase/migrations/20260605100000_create_flat_offers.sql:11`). |
| Saved offers are read-only after creation in this slice; deletion is a hard delete. | README says saved offers are read-only (`README.md:119`) and deletion removes the row/content immediately (`README.md:121`). | DB denies update (`supabase/migrations/20260605100000_create_flat_offers.sql:55`) and permits owner delete (`supabase/migrations/20260605100000_create_flat_offers.sql:62`). |
| First question-base visit creates the buyer's personal copy from active templates; repeat visits preserve it. | README says first `/dashboard` visit initializes a copy and repeat visits preserve it (`README.md:111`). | RPC returns when rows exist (`supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:19`, `supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:24`) and inserts active templates otherwise (`supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:27`, `supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:41`). |
| Reset replaces the whole buyer question list with the current active base. | README says reset deletes every current buyer question and recreates from active templates (`README.md:113`). | RPC deletes buyer rows then inserts active templates (`supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:64`, `supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:67`). |
| Buyer question rows are buyer-owned, ordered, and nonblank. | Access control requires login before copied base questions (`context/foundation/prd.md:108`). | DB has buyer FK, text check, nonnegative position, unique buyer position, and owner RLS (`supabase/migrations/20260604211412_create_question_ownership_contract.sql:24`, `supabase/migrations/20260604211412_create_question_ownership_contract.sql:30`, `supabase/migrations/20260604211412_create_question_ownership_contract.sql:36`, `supabase/migrations/20260604211412_create_question_ownership_contract.sql:73`). |
| Category membership is positional, not relational. | DB comment declares positional membership (`supabase/migrations/20260604211412_create_question_ownership_contract.sql:15`). | UI derives category by walking the current question base (`src/components/offers/OfferPreparationResult.astro:53`, `src/components/offers/OfferPreparationResult.astro:57`). |
| Preparation uses saved pasted content and the buyer's open questions. | PRD says the rule consumes buyer question base and pasted offer content (`context/foundation/prd.md:102`). | Service passes saved offer id/title/content to extractor (`src/lib/services/offer-preparation.ts:66`, `src/lib/services/offer-preparation.ts:70`) and filters open questions (`src/lib/services/offer-preparation.ts:72`, `src/lib/services/offer-preparation.ts:73`). |
| Preparation should produce four buckets: answered, unanswered, doubtful, unmapped. | PRD lists the same output categories (`context/foundation/prd.md:104`). | App schema requires four arrays for completed results (`src/lib/services/extraction-contract.ts:49`, `src/lib/services/extraction-contract.ts:54`); DB checks only bucket keys and array types (`supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:2`, `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:11`). |
| Facts may be answered only when pasted content explicitly supports them. | PRD says no invented facts (`context/foundation/prd.md:47`) and no repeated known facts unless doubt exists (`context/foundation/prd.md:48`). | Prompt instructs the provider to use only pasted content and explicit evidence (`src/lib/services/extraction-contract.ts:103`, `src/lib/services/extraction-contract.ts:105`); schema only requires evidence strings (`src/lib/services/extraction-contract.ts:19`, `src/lib/services/extraction-contract.ts:35`, `src/lib/services/extraction-contract.ts:45`). |
| Unanswered questions are all open questions not answered or related to doubtful facts. | PRD requires unanswered questions to be visible separately (`context/foundation/prd.md:84`). | Provider output omits unanswered first (`src/lib/services/extraction-provider.ts:93`), then local code completes unanswered from question ids not mapped by answers/doubtful facts (`src/lib/services/extraction-provider.ts:149`, `src/lib/services/extraction-provider.ts:161`). |
| At most one completed preparation result exists per saved offer. | Roadmap says S-03 is the north-star result slice (`context/foundation/roadmap.md:24`); current type status is only `completed` (`src/types.ts:70`). | Service blocks if an existing result is found (`src/lib/services/offer-preparation.ts:44`, `src/lib/services/offer-preparation.ts:49`); DB has `unique (offer_id)` (`supabase/migrations/20260609143000_create_offer_extraction_results.sql:19`). |
| A result buyer must own the referenced offer. | Buyer-owned saved material is sensitive (`context/foundation/roadmap.md:109`). | DB trigger rejects owner mismatch (`supabase/migrations/20260609143000_create_offer_extraction_results.sql:38`, `supabase/migrations/20260609143000_create_offer_extraction_results.sql:44`) and RLS insert checks offer ownership (`supabase/migrations/20260609143000_create_offer_extraction_results.sql:85`, `supabase/migrations/20260609143000_create_offer_extraction_results.sql:91`). |
| Failed extraction attempts are not persisted. | The PRD only promises usable results; bad extraction must not become buyer review data (`context/foundation/prd.md:100`). | Service returns before insert on extractor failure (`src/lib/services/offer-preparation.ts:77`, `src/lib/services/offer-preparation.ts:79`); test asserts no insert on provider failure (`src/lib/services/offer-preparation.test.ts:73`, `src/lib/services/offer-preparation.test.ts:86`). |
| Extraction should finish within 60 seconds. | PRD non-functional requirement (`context/foundation/prd.md:93`). | Timeout constant is 55 seconds (`src/lib/services/extraction-contract.ts:5`) and provider aborts using that timeout (`src/lib/services/extraction-provider.ts:53`, `src/lib/services/extraction-provider.ts:55`). |

## Step 2 - Classification and Choice

| Invariant | Core to product | Spread across layers | Enforcement state |
|---|---:|---:|---|
| Buyer-owned offer privacy | High | Medium: middleware, service, DB, tests | Enforced strongly by RLS and tests. |
| Saved offer input validity | Medium | Medium: API, DB, tests | Mostly enforced; URL shape is API-only. |
| Question-base lazy initialization/reset | High | Medium: service, DB RPC, UI, tests | Enforced strongly by transactional RPC. |
| Four-bucket preparation result | Very high | High: PRD, types, prompt, provider parser, service, DB JSON, UI, tests | Enforced in app; DB only partially enforces bucket existence/array type. |
| No invented facts / explicit evidence | Very high | High: PRD, prompt, schemas, UI display, tests | Mostly declared; evidence is nonblank but not grounded against pasted content. |
| Unanswered completion from open buyer questions | Very high | High: PRD, service, provider post-processing, UI, tests | Enforced locally, but not protected at persistence boundary. |
| One completed result per offer | High | Medium: UI, API/service, DB | Enforced by service and unique index. Race after extraction wastes work but unique constraint stops duplication. |
| Result buyer owns offer | High | Low: DB trigger/RLS, tests | Enforced strongly. |
| Failed extraction not persisted | High | Medium: service, tests | Enforced in orchestration, but not named as a domain rule. |

Chosen invariant:

> A viewing-preparation result for a saved offer is accepted exactly once, only for the buyer-owned saved offer and buyer-owned open question base, and every accepted answered/doubtful/unmapped fact must be grounded in the saved pasted content while unanswered questions are completed server-side.

Why this one: S-03 is explicitly the north-star slice because the product only earns value when pasted offer content becomes a useful, trustworthy question list (`context/foundation/roadmap.md:24`). It also combines the most important trust guardrails: no invented facts, no repeated known facts unless doubtful, and visible unanswered/unmapped outputs (`context/foundation/prd.md:47`, `context/foundation/prd.md:48`, `context/foundation/prd.md:104`). It is smeared across the most layers: route, service, provider, prompt, zod schema, DB JSON constraints, UI grouping, and tests. It is also the weakest core invariant because the hardest part, factual grounding, is only a prompt instruction plus nonblank evidence strings; the database accepts any array-shaped bucket values.

## Step 3 - Diagnosis of the Chosen Invariant

Where the rule lives today:

| Location | Current rule | Diagnosis |
|---|---|---|
| PRD | No invented facts and no repeated already-known facts unless uncertain (`context/foundation/prd.md:47`, `context/foundation/prd.md:48`). | Declared as business truth, not directly enforced. |
| PRD | Mapping rule and four outputs (`context/foundation/prd.md:100`, `context/foundation/prd.md:104`). | Clear domain rule, but no aggregate owns it. |
| API route | Auth and id parsing before preparation (`src/pages/api/offers/[id]/prepare.ts:17`, `src/pages/api/offers/[id]/prepare.ts:21`). | Thin enough, but maps service string reasons instead of domain errors (`src/pages/api/offers/[id]/prepare.ts:42`, `src/pages/api/offers/[id]/prepare.ts:45`). |
| Service | Loads saved offer and returns not found/storage (`src/lib/services/offer-preparation.ts:35`, `src/lib/services/offer-preparation.ts:40`). | Ownership depends on Supabase RLS, not an explicit domain precondition. |
| Service | Checks existing result before extraction (`src/lib/services/offer-preparation.ts:44`, `src/lib/services/offer-preparation.ts:49`). | Correct, but non-atomic with the later insert and extraction call. A concurrent request can still do duplicate provider work and only fail at insert. |
| Service | Loads question base and filters open questions (`src/lib/services/offer-preparation.ts:61`, `src/lib/services/offer-preparation.ts:73`). | The aggregate boundary is implicit. A future caller could bypass this and pass arbitrary question ids into result persistence. |
| Service | Does not persist failed extraction (`src/lib/services/offer-preparation.ts:77`, `src/lib/services/offer-preparation.ts:82`). | Good fail-fast behavior, but represented as transport-like result strings rather than domain errors. |
| Extraction prompt | Provider must use only pasted content and explicit evidence (`src/lib/services/extraction-contract.ts:103`, `src/lib/services/extraction-contract.ts:105`). | Prompt text is not a guardian. It can be violated by provider output or direct DB insert. |
| Extraction schema | Evidence fields must be nonblank strings (`src/lib/services/extraction-contract.ts:19`, `src/lib/services/extraction-contract.ts:35`, `src/lib/services/extraction-contract.ts:45`). | Shape is enforced, but grounding is not. |
| Provider parser | Invalid JSON/schema returns `invalid_output` (`src/lib/services/extraction-provider.ts:87`, `src/lib/services/extraction-provider.ts:90`). | Good fail-fast parser, but only for model output shape. |
| Provider post-processing | Unanswered questions are completed locally from open questions not mapped to answers/doubtful facts (`src/lib/services/extraction-provider.ts:149`, `src/lib/services/extraction-provider.ts:161`). | This key rule sits in provider code instead of an aggregate. |
| Persistence service | Completed result schema is checked before insert (`src/lib/services/offer-extraction-results.ts:67`, `src/lib/services/offer-extraction-results.ts:72`). | Stronger than DB, but bypassable by any direct table insert with authenticated grants. |
| Persistence DB | Unique result per offer (`supabase/migrations/20260609143000_create_offer_extraction_results.sql:19`). | Enforced. |
| Persistence DB | Buyer/result offer-owner match (`supabase/migrations/20260609143000_create_offer_extraction_results.sql:38`, `supabase/migrations/20260609143000_create_offer_extraction_results.sql:44`). | Enforced. |
| Persistence DB | Result JSON is object with four array buckets (`supabase/migrations/20260609143000_create_offer_extraction_results.sql:11`, `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:2`). | Too weak for a core trust invariant: item shape, question references, and evidence grounding are not enforced. |
| Persistence grants | Authenticated users can insert into `offer_extraction_results` (`supabase/migrations/20260609143000_create_offer_extraction_results.sql:116`). | This lets clients bypass the service-level `completedExtractionResultSchema` and aggregate workflow. |
| UI | Button disabled if a result exists (`src/components/offers/PrepareViewingButton.tsx:38`, `src/components/offers/PrepareViewingButton.tsx:76`). | UI is a helpful affordance, not an invariant guardian. |
| UI | Detail page loads result and question base separately (`src/pages/offers/[id].astro:20`, `src/pages/offers/[id].astro:22`). | Display grouping depends on current question base, not the base snapshot used to create the result. |
| UI | Existing results may render without categories if question base load fails (`src/pages/offers/[id].astro:144`, `src/pages/offers/[id].astro:150`). | UI swallows category integrity into degraded display instead of preserving creation-time grouping. |
| UI | Grouping uses current question metadata (`src/components/offers/OfferPreparationResult.astro:30`, `src/components/offers/OfferPreparationResult.astro:63`). | Old results can be regrouped by later question-base changes. |
| Tests | Service tests cover success, rerun block, no persist on failure, storage failure, unique conflict (`src/lib/services/offer-preparation.test.ts:16`, `src/lib/services/offer-preparation.test.ts:21`). | Good coverage for orchestration, not a named aggregate. |
| Tests | Provider tests cover prompt content and invalid output (`src/lib/services/extraction-provider.test.ts:40`, `src/lib/services/extraction-provider.test.ts:62`). | Good parser checks, no evidence-grounding tests. |
| Tests | DB tests assert uniqueness and bucket constraints exist (`supabase/tests/database/offer_extraction_results_contract.test.sql:167`, `supabase/tests/database/offer_extraction_results_contract.test.sql:183`). | DB contract intentionally covers shape at bucket level, not item-level validity. |

Inconsistent or weak enforcement:

- Client-only guard: duplicate prevention is visible in the UI button state (`src/components/offers/PrepareViewingButton.tsx:38`, `src/components/offers/PrepareViewingButton.tsx:76`), but must remain server/DB-owned because clients are bypassable.
- Partially swallowed error: result load failure becomes a page warning while the offer remains displayed (`src/pages/offers/[id].astro:135`, `src/pages/offers/[id].astro:141`). That is acceptable for read display, but aggregate creation must not use this pattern.
- Weakest gap: prompt says evidence must come from pasted content (`src/lib/services/extraction-contract.ts:103`, `src/lib/services/extraction-contract.ts:110`), but neither `completedExtractionResultSchema` nor DB constraints prove it.
- Persistence bypass: direct authenticated inserts can satisfy the four-array DB check without satisfying item-level schema because DB only checks bucket existence/type (`supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:2`, `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:11`).

## Step 4 - Guardian Aggregate Design

Aggregate root: `ViewingPreparation`.

Purpose: it is the only server-side object allowed to accept an extraction result and create a persisted viewing-preparation result.

Owned state:

- `buyerId`
- `offerId`
- `offerTitle`
- `pastedContent`
- `pastedContentHash`
- `openQuestions: OpenQuestion[]`
- `existingResultId: string | null`
- `completedResult: ExtractionResult | null`

Named domain errors:

- `ViewingPreparationAlreadyCompletedError`
- `ViewingPreparationOfferNotFoundError`
- `ViewingPreparationQuestionBaseUnavailableError`
- `ExtractionProviderFailedError`
- `InvalidExtractionResultError`
- `UngroundedExtractionEvidenceError`
- `UnknownExtractionQuestionReferenceError`
- `IncompleteUnansweredQuestionsError`

Domain methods:

```ts
class ViewingPreparation {
  static load(snapshot: ViewingPreparationSnapshot): ViewingPreparation;

  prepareWith(providerResult: ProviderExtractionResult, metadata: ExtractionMetadata): CompletedViewingPreparation;

  private assertNotCompleted(): void;
  private acceptProviderBuckets(providerResult: ProviderExtractionResult): AcceptedProviderBuckets;
  private completeUnansweredQuestions(buckets: AcceptedProviderBuckets): ExtractionResult;
  private assertAllQuestionReferencesBelongToOpenQuestions(result: ExtractionResult): void;
  private assertEvidenceGroundedInOffer(result: ExtractionResult): void;
}
```

Pseudocode:

```ts
prepareWith(providerResult, metadata) {
  this.assertNotCompleted();

  if (!providerResult.ok) {
    throw new ExtractionProviderFailedError(providerResult.reason);
  }

  const buckets = this.acceptProviderBuckets(providerResult.result);
  const completed = this.completeUnansweredQuestions(buckets);

  this.assertAllQuestionReferencesBelongToOpenQuestions(completed);
  this.assertEvidenceGroundedInOffer(completed);

  this.completedResult = completed;

  return {
    offerId: this.offerId,
    buyerId: this.buyerId,
    result: completed,
    model: metadata.model,
    latencyMs: metadata.latencyMs,
    pastedContentHash: this.pastedContentHash,
    questionSnapshot: this.openQuestions,
  };
}
```

Preconditions:

- The aggregate is loaded for an authenticated buyer.
- The saved offer exists and belongs to the buyer.
- The saved offer has no existing preparation result.
- The open-question list is loaded by the server, not supplied by the client.
- Provider output matches the accepted provider schema.
- Every `questionId` and `relatedQuestionId` is from the aggregate's open-question ids.
- Every answered/doubtful/unmapped evidence value is grounded in the saved `pastedContent`.

Evidence-grounding rule:

- Refactor the extraction contract from "short excerpt or compact summary" to "exact short excerpt copied from pasted content".
- Normalize whitespace and case before comparison.
- If a fact needs a summary but no exact excerpt, it must be rejected as `UngroundedExtractionEvidenceError` or moved to a future explicit `needsReview` bucket. Do not persist it silently.

Repository:

```ts
interface ViewingPreparationRepository {
  loadForPreparation(buyerId: string, offerId: string): Promise<ViewingPreparation>;
  saveCompleted(completed: CompletedViewingPreparation): Promise<OfferExtractionResult>;
}
```

Persistence plan:

- Move direct table writes behind a DB RPC, for example `complete_viewing_preparation`.
- Revoke direct authenticated insert on `offer_extraction_results`; keep read only for authenticated owners.
- The RPC validates owner, no existing result, result schema, question references, and optionally `pasted_content_hash`.
- The repository is the only app caller of this RPC.

Atomicity:

The provider call cannot run inside a database transaction because it is a slow network call. Use a two-stage fail-fast design:

1. `loadForPreparation` reads the buyer-owned offer, existing result state, and open questions.
2. The provider is called outside a transaction.
3. `saveCompleted` runs one transaction/RPC:

```sql
begin;
  select *
  from public.flat_offers
  where id = requested_offer_id
    and buyer_id = auth.uid()
  for update;

  if not found then
    raise exception 'Viewing preparation offer not found';
  end if;

  if exists (
    select 1
    from public.offer_extraction_results
    where offer_id = requested_offer_id
  ) then
    raise exception 'Viewing preparation already completed';
  end if;

  -- validate result JSON shape and references, then insert once
  insert into public.offer_extraction_results (...);
commit;
```

This does not prevent duplicate provider calls under concurrency, but it makes acceptance/persistence atomic and fail-fast. If duplicate provider cost becomes important, add a separate `preparation_attempts` lease/status table later; do not add it for this refactor unless tests prove it is needed.

Thin API route:

```ts
export const POST: APIRoute = async (context) => {
  requireUser(context.locals.user);
  const { id } = parseParams(context.params);
  const repository = createViewingPreparationRepository(context);
  const aggregate = await repository.loadForPreparation(context.locals.user.id, id);
  const providerResult = await extractor.extract(aggregate.extractionInput());
  const completed = aggregate.prepareWith(providerResult, providerResult.metadata);
  const saved = await repository.saveCompleted(completed);
  return jsonResponse({ status: "completed", resultId: saved.id }, 201);
};
```

Domain error mapping:

| Domain error | HTTP |
|---|---:|
| `ViewingPreparationOfferNotFoundError` | 404 |
| `ViewingPreparationAlreadyCompletedError` | 409 |
| `InvalidExtractionResultError` | 502 |
| `UngroundedExtractionEvidenceError` | 502 |
| `UnknownExtractionQuestionReferenceError` | 502 |
| `IncompleteUnansweredQuestionsError` | 500 |
| `ExtractionProviderFailedError("timeout")` | 504 |
| `ExtractionProviderFailedError("provider")` | 502 |
| `ViewingPreparationQuestionBaseUnavailableError` | 500 |

## Step 5 - Before/After, Plan, Tests

### Before / After

| Current place | Before | After |
|---|---|---|
| `src/pages/api/offers/[id]/prepare.ts` | Route calls service and maps string reasons (`src/pages/api/offers/[id]/prepare.ts:31`, `src/pages/api/offers/[id]/prepare.ts:42`). | Route parses input, invokes aggregate workflow, maps named domain errors. No business branching beyond HTTP mapping. |
| `src/lib/services/offer-preparation.ts` | Loads offer/result/questions, calls provider, persists result (`src/lib/services/offer-preparation.ts:35`, `src/lib/services/offer-preparation.ts:61`, `src/lib/services/offer-preparation.ts:82`). | Becomes application service that coordinates repository + provider + aggregate; no invariant logic remains inline. |
| `src/lib/services/extraction-provider.ts` | Completes unanswered questions in provider code (`src/lib/services/extraction-provider.ts:149`, `src/lib/services/extraction-provider.ts:161`). | Provider returns only provider buckets. Aggregate completes unanswered questions. |
| `src/lib/services/extraction-contract.ts` | Prompt allows excerpt or compact summary (`src/lib/services/extraction-contract.ts:110`). | Prompt requires exact excerpts for evidence fields so aggregate can verify grounding. |
| `src/lib/services/offer-extraction-results.ts` | Validates completed schema before direct insert (`src/lib/services/offer-extraction-results.ts:67`, `src/lib/services/offer-extraction-results.ts:72`). | Repository calls RPC/transaction; no direct insert API exposed to callers. |
| `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql` | DB checks four arrays only (`supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:2`, `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:11`). | New migration adds RPC and revokes direct insert; DB enforces entry point and atomic save. |
| `src/components/offers/PrepareViewingButton.tsx` | UI disables button when `hasResult` is true (`src/components/offers/PrepareViewingButton.tsx:38`, `src/components/offers/PrepareViewingButton.tsx:76`). | UI remains an affordance only. Server aggregate remains the guardian. |
| `src/pages/offers/[id].astro` and `OfferPreparationResult.astro` | Result grouping depends on current question base (`src/pages/offers/[id].astro:20`, `src/components/offers/OfferPreparationResult.astro:53`). | Persist the open-question snapshot/category snapshot used during creation, or persist stable `questionPosition`/`categoryTitle` in result items. Display no longer depends on later question-base changes. |

### Refactoring Phases

1. Add domain model tests first (`pnpm.cmd run test:app` target).
   - `ViewingPreparation.prepareWith` accepts valid provider buckets and completes unanswered questions.
   - Throws `ViewingPreparationAlreadyCompletedError` when a result already exists.
   - Throws `UnknownExtractionQuestionReferenceError` for answer/doubtful references outside the loaded open-question list.
   - Throws `UngroundedExtractionEvidenceError` when evidence is not an exact normalized excerpt from pasted content.
   - Throws `InvalidExtractionResultError` for malformed buckets.

2. Introduce `ViewingPreparation` aggregate and domain errors under a domain/service boundary.
   - Keep the public route behavior unchanged.
   - Move unanswered completion out of provider code.
   - Keep provider schema parsing, but treat it as input validation, not invariant ownership.

3. Add repository tests with fakes.
   - Repository loads offer, existing result, and open questions into one snapshot.
   - Save maps DB unique conflict to `ViewingPreparationAlreadyCompletedError`.
   - Save does not swallow DB/RLS failures.

4. Add Supabase migration and database tests.
   - Create `complete_viewing_preparation` RPC.
   - Revoke direct authenticated insert on `offer_extraction_results`.
   - Test that direct authenticated insert is denied.
   - Test RPC rejects duplicate result.
   - Test RPC rejects buyer/offer mismatch.
   - Test RPC rejects malformed result JSON.

5. Wire the API route to the aggregate workflow.
   - Keep status codes from today's route: 404, 409, 413, 502, 504, 500 (`src/pages/api/offers/[id]/prepare.ts:45`, `src/pages/api/offers/[id]/prepare.ts:61`).
   - Replace string-reason branching with domain error mapping.

6. Update rendering snapshot behavior.
   - Persist question category/order snapshot at result creation.
   - Stop loading the current question base just to render old result grouping.
   - Keep current question-base load only where editing/current-base UI needs it.

7. Verification.
   - Run `pnpm.cmd run test:app`.
   - Run the specific Supabase database test for extraction results.
   - Run `pnpm.cmd run lint`.
   - Run `pnpm.cmd run build`.
   - Manually verify `/offers/:id` prepare flow with `pnpm.cmd run dev` only if UI wiring changes.

### Test Cases for the Invariant

Legal:

- Buyer prepares their own saved offer with valid provider output.
- Result has answered, unanswered, doubtful, and unmapped buckets.
- Unanswered contains every open question not answered and not related to a doubtful fact.
- Evidence excerpts all exist in pasted content after normalization.
- Saved result preserves the question/category snapshot used at creation.

Illegal:

- Preparing an offer that already has a result.
- Preparing another buyer's offer.
- Persisting provider output with unknown question ids.
- Persisting answer/doubtful/unmapped evidence not grounded in pasted content.
- Persisting malformed bucket items via repository/RPC.
- Direct authenticated insert into `offer_extraction_results`.
- Provider failure, timeout, invalid JSON, or invalid schema followed by any persisted row.

### Load-Bearing Names

No formal contract registry file was found in `context`, `src`, `supabase`, or `README.md`. Register these names in the next project glossary/contract registry if one is introduced:

- `ViewingPreparation`
- `ViewingPreparationRepository`
- `CompletedViewingPreparation`
- `ProviderExtractionResult`
- `OpenQuestionSnapshot`
- `EvidenceExcerpt`
- `ViewingPreparationAlreadyCompletedError`
- `UngroundedExtractionEvidenceError`
- `UnknownExtractionQuestionReferenceError`
- `IncompleteUnansweredQuestionsError`

## Summary

The core weak invariant is not simple duplicate prevention; it is trustworthy acceptance of a viewing-preparation result. Today the most important trust rule is split between prompt text, service orchestration, zod schemas, weak DB JSON checks, and UI rendering. The refactor should introduce `ViewingPreparation` as the aggregate root that accepts provider output, completes unanswered questions, validates references, verifies evidence against pasted content, and throws named domain errors on illegal operations. Persistence should move behind a repository and one transactional RPC that atomically saves the completed result and rejects duplicates or ownership violations. The API should become a thin parser/caller/error mapper, while the UI remains only an affordance. The highest-value tests are aggregate tests for legal/illegal result acceptance, database tests for the new RPC and revoked direct insert, and route tests for domain-error-to-HTTP mapping.
