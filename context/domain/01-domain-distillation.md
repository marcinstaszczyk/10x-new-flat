---
title: 10xNewFlat Domain Distillation
created: 2026-06-12
type: domain-distillation
---

# 10xNewFlat Domain Distillation

## Step 0 - Project Context

Source material read:

- Product requirements: `context/foundation/prd.md`.
- Delivery sequence and product-risk framing: `context/foundation/roadmap.md`.
- Stack decision: `context/foundation/tech-stack.md`.
- Operational README: `README.md`.
- Extended change history: archived plans under `context/archive/2026-06-04-buyer-data-ownership-contract/`, `context/archive/2026-06-04-buyer-account-question-base/`, `context/archive/2026-06-05-saved-pasted-offer/`, `context/archive/2026-06-08-extraction-contract-check/`, and `context/archive/2026-06-09-extracted-viewing-preparation/`.
- Tests as executable contracts: `supabase/tests/database/*.test.sql`, `src/lib/services/*.test.ts`, and `context/foundation/test-plan.md`.

The project has enough requirements material; this map does not rely on code alone.

Stack and structure:

| Layer | Location | Domain role |
|---|---|---|
| UI | `src/pages/**`, `src/components/**` | Server-rendered pages and Solid islands for question base, saved offers, and preparation results. |
| API | `src/pages/api/**` | Mutation and trigger boundaries, zod input validation, redirects/JSON responses. |
| Service/application | `src/lib/services/**` | Use-case orchestration for question base, saved offers, extraction, and offer preparation. |
| DTO/types | `src/types.ts` | App-facing names for buyer questions, saved offers, extraction inputs/results, and Supabase table contracts. |
| Persistence/domain constraints | `supabase/migrations/**` | RLS, ownership, lifecycle functions, uniqueness, cascade, and shape constraints. |
| Tests/contracts | `supabase/tests/database/**`, `src/lib/services/*.test.ts`, `tests/e2e/**` | Executable evidence for ownership, lifecycle, extraction, and primary flow expectations. |

There is no explicit domain layer or aggregate module. The domain model is split across Supabase schema/RLS, service functions, DTOs, routes, and UI rendering.

## Step 1 - Ubiquitous Language

| Concept | Definition | Source quote | Code location |
|---|---|---|---|
| Buyer | The primary user: a logged-in person preparing for a flat viewing. | `context/foundation/prd.md:28` - "Primary persona: buyer preparing for a flat viewing." | `src/middleware.ts:11` resolves `user`; `src/types.ts:100`, `src/types.ts:111`, `src/types.ts:122` carry `buyer_id`. |
| Flat viewing | The event the buyer prepares questions/topics for. | `context/foundation/prd.md:22` - "Preparing questions and topics for a flat viewing takes time" | Operation name `prepareOfferViewing` in `src/lib/services/offer-preparation.ts:29`; no separate entity. |
| Question knowledge base | The product's reusable knowledge of what generally should be asked. | `context/foundation/prd.md:24` - "combines a knowledge base of what generally should be asked" | Implemented as templates and buyer rows: `supabase/migrations/20260604211412_create_question_ownership_contract.sql:3`, `:22`. |
| Fixed base question list / question template | Canonical ordered source document copied to buyers. | `context/foundation/prd.md:71` - "copy a fixed base question list to the buyer" | `question_templates` table at `supabase/migrations/20260604211412_create_question_ownership_contract.sql:3`; DTO at `src/types.ts:131`. |
| Buyer question base / personal copy | Buyer-owned ordered copy of active templates, initialized lazily and preserved on repeat visits. | `README.md:111` - "first `/dashboard` visit initializes the buyer-owned copy" | `loadBuyerQuestionBase` calls `ensure_buyer_question_base` in `src/lib/services/questions.ts:22`; table comment at `supabase/migrations/20260604211412_create_question_ownership_contract.sql:39`. |
| Category row | A display header in an ordered question document; membership is positional. | `supabase/migrations/20260604211412_create_question_ownership_contract.sql:39` - "Category rows are display headers" | Type value at `src/types.ts:1`; grouping uses current category at `src/components/offers/OfferPreparationResult.astro:57`. |
| Open question | A question row that can be sent to extraction and shown as answered/unanswered. | `supabase/migrations/20260604211412_create_question_ownership_contract.sql:1` defines `'open_question'`. | Filtered for extraction at `src/lib/services/offer-preparation.ts:72`. |
| Flat offer entry / saved offer | Buyer-owned saved source material for one property offer. | `context/foundation/prd.md:76` - "Buyer can create a flat offer entry." | DTO at `src/types.ts:11`; table at `supabase/migrations/20260605100000_create_flat_offers.sql:1`; service at `src/lib/services/offers.ts:65`. |
| Pasted offer-page content | Manual source material pasted by the buyer into a saved offer. | `context/foundation/prd.md:78` - "paste offer-page content into a flat offer entry." | Required form field at `src/pages/offers/new.astro:65`; nonblank DB column at `supabase/migrations/20260605100000_create_flat_offers.sql:11`. |
| Source URL | Optional original offer URL attached to a saved offer. | `README.md:119` - "optional source URL." | API schema at `src/pages/api/offers/create.ts:10`; DB column at `supabase/migrations/20260605100000_create_flat_offers.sql:7`. |
| Offer extraction | Server-side transformation of pasted content into structured preparation output. | `context/foundation/prd.md:80` - "transform pasted offer content into question and answer form." | `extractOfferPreparation` in `src/lib/services/extraction.ts:27`; OpenRouter call in `src/lib/services/extraction-provider.ts:48`. |
| Viewing-preparation result / offer extraction result | Persisted result for one saved offer, shown to the buyer for review. | `context/foundation/roadmap.md:24` - "pasted offer content becomes a useful, trustworthy question list." | DTO at `src/types.ts:72`; table at `supabase/migrations/20260609143000_create_offer_extraction_results.sql:1`; result UI at `src/components/offers/OfferPreparationResult.astro:83`. |
| Answered question pair | A buyer question matched to explicit offer evidence and an answer. | `context/foundation/prd.md:56` - "extracted question and answer pairs." | `AnsweredExtractionQuestion` at `src/types.ts:36`; prompt rule at `src/lib/services/extraction-contract.ts:104`. |
| Unanswered question | An open buyer question with no explicit answer or related doubtful fact. | `context/foundation/prd.md:61` - "Unanswered questions are visible separately." | `UnansweredExtractionQuestion` at `src/types.ts:44`; local completion at `src/lib/services/extraction-provider.ts:149`. |
| Doubtful fact | Suspicious, contradictory, vague, or uncertain offer value needing review. | `context/foundation/prd.md:47` - "uncertain extracted values are marked as unknown or doubtful." | `DoubtfulExtractionFact` at `src/types.ts:49`; prompt bucket rule at `src/lib/services/extraction-contract.ts:108`. |
| Unmapped fact | Useful extracted offer fact that does not map to a base question. | `context/foundation/prd.md:86` - "extracted but not mapped to any base question." | `UnmappedExtractionFact` at `src/types.ts:57`; prompt bucket rule at `src/lib/services/extraction-contract.ts:109`. |
| Reset question base | Destructive replacement of a buyer's current question rows with active templates. | `README.md:113` - "Reset is destructive: it deletes every current buyer question" | RPC at `supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:46`; route at `src/pages/api/questions/reset.ts:12`. |
| Personal questions and notes | Future buyer-specific editing and notes capability. | `context/foundation/prd.md:89` - "add, edit, or remove personal questions and notes." | Questions are partially supported by table permissions; notes are ABSENT from the code. No `notes` match was found under `src` or `supabase`. |
| Admin-managed base question list | Nice-to-have capability outside MVP. | `context/foundation/prd.md:119` - "Nice-to-have access capability" and `:120` - "Admin-managed base question list." | ABSENT from the code; no admin routes or roles found. |

## Step 2 - Subdomain Classification

| Concept / area | Category | Why |
|---|---|---|
| Viewing-preparation result | Core | The roadmap names S-03 as the north star because the product earns value when pasted offer content becomes a useful question list (`context/foundation/roadmap.md:24`). |
| Offer extraction and mapping | Core | The PRD vision combines offer-data aggregation with question knowledge and avoids repeated known facts (`context/foundation/prd.md:24`, `:48`). |
| Question knowledge base | Core | It is half of the product promise: "what generally should be asked" (`context/foundation/prd.md:24`). |
| Answered, unanswered, doubtful, and unmapped buckets | Core | These buckets express the trust model and review workflow from US-01 and guardrails (`context/foundation/prd.md:56`, `:61`, `:62`, `:86`). |
| Buyer question base lifecycle | Supporting | It enables the core preparation flow, but lazy copy/reset mechanics are not the product advantage by themselves (`context/foundation/roadmap.md:88`, `:97`). |
| Saved offer workspace | Supporting | Necessary precursor for extraction; roadmap makes S-02 a prerequisite to S-03 (`context/foundation/roadmap.md:100`, `:112`). |
| Buyer data ownership and RLS | Supporting | Essential risk control for sensitive pasted content, but not differentiating domain behavior (`context/foundation/roadmap.md:70`, `context/foundation/prd.md:94`). |
| Personal questions and notes | Supporting | A must-have FR in PRD but roadmap keeps it after the core S-03 proof and blocked on ownership decision (`context/foundation/roadmap.md:125`, `:134`). |
| Authentication | Generic | Required access control; MVP has only the Buyer role (`context/foundation/prd.md:112`). |
| Source URL | Generic | Metadata for a saved offer, not central to the viewing-preparation model. |
| Cloudflare, Sentry, CI, Supabase client setup | Generic | Platform/infrastructure concerns. |
| Admin-managed base list, offer comparison, scoring, link import | Generic / out of MVP | Explicitly nice-to-have or non-goals (`context/foundation/prd.md:120`, `:129`, `:130`, `:132`). |

## Step 3 - Aggregate Candidates and Invariants

| Aggregate candidate | Invariant | Source quote | Enforcement status |
|---|---|---|---|
| Buyer Question Base | First visit creates exactly one personal copy from active templates; repeat visits preserve existing rows. | `context/foundation/prd.md:114` - "copies the fixed base question list"; `:115` - "Repeat question-base visits preserve" | Enforced by `ensure_buyer_question_base`: no-op when rows exist at `supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:19`; insert active templates at `:27`. Tested at `supabase/tests/database/question_base_lifecycle.test.sql:149`. |
| Buyer Question Base | Reset replaces the entire buyer list with the current active base and removes personal rows. | `context/foundation/prd.md:116` - "reset the entire personal question list"; `README.md:113` - "Reset is destructive" | Enforced by delete+insert in `supabase/migrations/20260605090000_add_question_base_lifecycle_functions.sql:64`; tested at `supabase/tests/database/question_base_lifecycle.test.sql:214`. |
| Buyer Question Base | Rows are buyer-owned, nonblank, ordered, and position-unique per buyer. | `context/foundation/prd.md:108` - "Buyers log in before accessing ... copied base questions" | Enforced by FK/check/unique at `supabase/migrations/20260604211412_create_question_ownership_contract.sql:24`, `:30`, `:32`, `:36`; RLS at `:73`. |
| Buyer Question Base | Category membership is positional, not relational. | `supabase/migrations/20260604211412_create_question_ownership_contract.sql:15` - "Category membership is positional" | Declared in DB comments and UI grouping; not structurally enforced beyond ordering. UI derives category from current preceding category at `src/components/offers/OfferPreparationResult.astro:53`. |
| Saved Flat Offer | A saved offer belongs to exactly one buyer and only that buyer can read/delete it. | `context/foundation/prd.md:94` - "Pasted offer content is visible only to the logged-in buyer." | Enforced by `buyer_id default auth.uid()` and RLS at `supabase/migrations/20260605100000_create_flat_offers.sql:3`, `:43`, `:62`; tested at `supabase/tests/database/flat_offers_contract.test.sql:198`, `:272`. |
| Saved Flat Offer | Title and pasted content must not be blank; source URL is optional but cannot be blank when present. | `context/archive/2026-06-05-saved-pasted-offer/plan.md:52` - "`source_url` is optional"; `:53` - "`title` and `pasted_content` are required" | Enforced by API zod at `src/pages/api/offers/create.ts:8`; DB checks at `supabase/migrations/20260605100000_create_flat_offers.sql:5`, `:7`, `:11`. |
| Saved Flat Offer | Offer rows are read-only after creation in the current slice; deletion is hard delete. | `context/archive/2026-06-05-saved-pasted-offer/plan.md:29` - "Delete is a hard delete"; `:31` - "No edit" | Enforced by denied update policy at `supabase/migrations/20260605100000_create_flat_offers.sql:55`; delete service at `src/lib/services/offers.ts:105`; tested at `supabase/tests/database/flat_offers_contract.test.sql:260`, `:301`. |
| Viewing Preparation Result | At most one extraction result exists per saved offer; reruns are blocked. | `context/archive/2026-06-09-extracted-viewing-preparation/plan.md:28` - "at most one extraction result per offer" | Enforced by unique `offer_id` at `supabase/migrations/20260609143000_create_offer_extraction_results.sql:19`; service checks existing result at `src/lib/services/offer-preparation.ts:44`; tested at `src/lib/services/offer-preparation.test.ts:52`. |
| Viewing Preparation Result | Result buyer must own the referenced offer. | `context/archive/2026-06-09-extracted-viewing-preparation/plan.md:95` - "`buyer_id` must match the referenced offer owner." | Enforced by trigger at `supabase/migrations/20260609143000_create_offer_extraction_results.sql:31`; RLS insert check at `:85`; tested at `supabase/tests/database/offer_extraction_results_contract.test.sql:497`. |
| Viewing Preparation Result | Result has four buckets: answered, unanswered, doubtful, unmapped. | `context/archive/2026-06-09-extracted-viewing-preparation/plan.md:5` - "four-bucket extraction contract" | Enforced by app schema at `src/lib/services/extraction-contract.ts:49`; DB bucket existence/array constraint at `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:1`. |
| Viewing Preparation Result | Unanswered questions are completed locally from open buyer questions not answered or related to doubtful facts. | `context/archive/2026-06-09-extracted-viewing-preparation/plan.md:48` - "app completes the `unansweredQuestions` bucket" | Enforced by `completeUnansweredQuestions` at `src/lib/services/extraction-provider.ts:149`; tested at `src/lib/services/extraction-provider.test.ts:16`. |
| Viewing Preparation Result | Failed extraction attempts are not persisted. | `context/archive/2026-06-09-extracted-viewing-preparation/plan.md:195` - "do not write an extraction-result row" | Enforced by early return at `src/lib/services/offer-preparation.ts:77`; tested at `src/lib/services/offer-preparation.test.ts:73`. |
| Extraction Request | Provider must use only pasted content and avoid invented facts. | `context/foundation/prd.md:47` - "does not invent offer facts" | Declared in prompt at `src/lib/services/extraction-contract.ts:102`; not fully enforceable by schema or DB. |
| Extraction Request | Extraction must return a usable result within 60 seconds. | `context/foundation/prd.md:93` - "within 60 seconds." | Enforced as provider timeout of 55,000 ms at `src/lib/services/extraction-contract.ts:5`; stored latency at `src/types.ts:78`. |
| Personal Questions and Notes | Buyer can add, edit, or remove personal questions and notes. | `context/foundation/prd.md:89` - "add, edit, or remove personal questions and notes." | Partially declared by buyer-question table permissions; UI/service only load/reset. Notes are ignored/ABSENT from code. |

## Step 4 - Model vs Code Divergences

| Model says | Code does | Evidence |
|---|---|---|
| Buyer can add, edit, or remove personal questions and notes. | The app exposes load/reset only; no notes model/table/API exists. Buyer-question DB permissions allow mutation, but no domain operation exists for add/edit/remove. | Model: `context/foundation/prd.md:89`. Code: `src/lib/services/questions.ts:22`, `:45`; reset route only at `src/pages/api/questions/reset.ts:12`. |
| Notes are a personal buyer capability. | Notes are absent, and roadmap says note ownership is unresolved. | Model: `context/foundation/prd.md:117`. Blocker: `context/foundation/roadmap.md:134`. Code: no `notes` files/tables found under `src` or `supabase`. |
| Slow or repeated saved-offer submission must not create duplicate entries. | There is no idempotency key, duplicate constraint, or duplicate-submit guard on saved offers. | Risk source: `context/foundation/test-plan.md:47`, phase not started at `:70`. Code: `flat_offers` has no uniqueness beyond PK at `supabase/migrations/20260605100000_create_flat_offers.sql:1`; create inserts directly at `src/lib/services/offers.ts:65`. |
| Source URL must be a valid absolute URL before insertion. | API validates URL, but database only rejects blank values. Direct authenticated table insert can bypass URL shape. | Model: `context/archive/2026-06-05-saved-pasted-offer/plan.md:52`. API: `src/pages/api/offers/create.ts:10`. DB: `supabase/migrations/20260605100000_create_flat_offers.sql:7`. |
| Extraction result has a strict four-bucket schema. | App service validates item-level shape; DB only checks bucket keys and that bucket values are arrays. Direct authenticated insert can bypass item-level schema. | Model: `context/archive/2026-06-09-extracted-viewing-preparation/plan.md:13`, `:48`. App: `src/lib/services/offer-extraction-results.ts:67`. DB: `supabase/migrations/20260609171000_enforce_offer_extraction_result_buckets.sql:1`. |
| The product does not invent offer facts. | The provider is prompted not to invent and schema requires evidence strings, but code cannot prove evidence came from pasted content. | Model: `context/foundation/prd.md:47`. Prompt: `src/lib/services/extraction-contract.ts:102`, `:105`, `:110`. Schema shape only: `src/lib/services/extraction-contract.ts:14`. |
| Uncertain values are marked "unknown or doubtful." | The implemented model has `doubtfulFacts` and `unansweredQuestions`, but no explicit `unknown` status/value classification. | Model: `context/foundation/prd.md:47`, `:62`. Code: `src/types.ts:44`, `:49`; UI bucket at `src/components/offers/OfferPreparationResult.astro:147`. |
| Product success is measured by buyer preparation time under 30/10 minutes. | Code stores extraction latency only; no buyer preparation-duration metric or success measurement exists. | Model: `context/foundation/prd.md:38`, `:39`. Code has only result latency at `src/types.ts:78` and provider timeout at `src/lib/services/extraction-contract.ts:5`. |
| Extraction result grouping should support a natural viewing conversation. | Result grouping uses the current buyer question base at render time, so later question edits/reorders can change how old results appear. This is documented as a known tradeoff. | Goal: `context/foundation/prd.md:43`. Tradeoff: `context/archive/2026-06-09-extracted-viewing-preparation/plan-brief.md:64`. Code: `src/components/offers/OfferPreparationResult.astro:30`. |

## Step 5 - Refactoring Ranking

| Rank | Candidate | Value | Risk | Why |
|---|---|---:|---:|---|
| 1 | Viewing Preparation Result / OfferExtractionResult | Very high | High | This is the north-star value slice. The app path validates result shape, but direct table insertion can bypass item-level schema, and the "no invented facts" invariant is only prompted. Strengthening this boundary gives the largest core-domain payoff. |
| 2 | Buyer Question Base | High | Medium | The base question document is core knowledge. First-visit and reset are strong, but category membership is only positional and future personal editing is not modeled as an aggregate operation. |
| 3 | Saved Flat Offer | Medium-high | Medium | It protects sensitive source material and is mostly well enforced. Remaining domain risk is duplicate creation on slow/repeated submit and DB-vs-API mismatch for `source_url` URL shape. |
| 4 | Personal Questions and Notes | Medium | High | PRD includes it, but roadmap blocks note ownership and code has no notes model. It should not outrank the core extraction result until ownership is decided. |
| 5 | Authentication / Buyer account | Medium | Low | Important but generic. Current route protection and RLS are established enough for MVP domain work. |

Refactoring target #1: the `Viewing Preparation Result` aggregate. It is the core proof of the product, and today its most important invariants are split across prompt text, service validation, and weak DB JSON constraints. A good refactor would make result creation a single owned boundary, remove or narrow direct client insertion, version the result schema, and make item-level bucket validity harder to bypass.
