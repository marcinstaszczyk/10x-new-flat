# Buyer Account Question Base Implementation Plan

## Overview

Deliver the first buyer-visible question-base flow. When an authenticated buyer first visits the dashboard, the system atomically creates their personal copy of all active question templates and renders the complete ordered list. Repeat visits preserve the personal copy. A confirmed reset action atomically deletes the buyer's entire current list and recreates it from the active templates.

This plan deliberately replaces the earlier "copy on account creation" requirement with lazy initialization on first question-list visit. The product foundation documents must be updated before implementation so the requirement, roadmap, database behavior, and UI describe one contract.

## Current State Analysis

F-01 is complete. The database contains an ordered `question_templates` document with 88 active Polish rows and an owner-isolated `buyer_questions` table. Category membership is positional: `category` rows are display headers, while `open_question` rows remain independent ordered rows. Existing pgTAP tests prove template visibility and owner-only CRUD.

The application resolves the authenticated user in middleware and protects `/dashboard`, but the dashboard is only a placeholder. Signup and sign-in do not create buyer questions, there is no question service or shared DTO, and there is no reset route. The current schema allows a buyer copy to be created, but it does not expose an atomic, retry-safe lifecycle operation for initialization or destructive reset.

### Key Discoveries

- The fixed source and buyer-owned target already exist, including active-template visibility and owner-only RLS (`supabase/migrations/20260604211412_create_question_ownership_contract.sql`).
- The canonical source contains 8 category rows and 80 open-question rows with deterministic positions (`supabase/migrations/20260604220000_insert_polish_question_templates.sql`).
- `buyer_questions` has a unique `(buyer_id, position)` contract, so a copy must be inserted atomically and repeat initialization must not insert again.
- Middleware resolves `context.locals.user` for every request and protects `/dashboard` (`src/middleware.ts`).
- The dashboard is server-rendered and already receives the authenticated user (`src/pages/dashboard.astro`).
- Successful sign-in currently redirects to `/`; the user chose to preserve that behavior (`src/pages/api/auth/signin.ts`).
- The PRD and shape notes still require copying on account creation, which conflicts with the chosen first-visit behavior (`context/foundation/prd.md`, `context/foundation/shape-notes.md`).
- There is no application test runner. Database behavior can be covered by pgTAP; UI and auth flows require manual verification.

## Desired End State

- Any authenticated buyer with no question rows can visit `/dashboard` and receive a complete personal copy of all active templates.
- Initialization is atomic, idempotent, owner-bound, and safe under repeated or concurrent dashboard requests.
- Repeat visits display the buyer's existing list without adding, replacing, or synchronizing rows.
- The dashboard renders one flat ordered document; category rows remain in the sequence but are visually presented as bold headings.
- A buyer can confirm a destructive reset that atomically deletes every personal row, including future custom rows, and recreates the list from the currently active templates.
- Initialization or reset failure never exposes a partial list as successful; the buyer sees a retryable error.
- Foundation documents describe first-visit initialization and explicit reset instead of account-creation copying.

## What We're NOT Doing

- Copying questions during signup, email confirmation, or sign-in.
- Redirecting successful sign-in to `/dashboard`.
- Backfilling every existing auth account during migration or deployment.
- Automatically synchronizing existing buyer copies when templates change.
- Preserving personal questions during reset.
- Adding question create, edit, delete, reorder, answer, note, or offer behavior.
- Adding a dedicated `/questions` page or changing the protected-route model beyond the reset endpoint.
- Adding an application test runner solely for this slice.
- Changing the F-01 migrations or historical F-01 plan.

## Implementation Approach

Add authenticated database RPC functions as the lifecycle boundary. `ensure_buyer_question_base()` obtains a buyer-scoped transaction lock, returns without mutation when any buyer rows already exist, and otherwise copies active templates in position order. `reset_buyer_question_base()` obtains the same lock, deletes every row owned by the current buyer, and copies the current active templates in the same transaction. Both functions derive ownership from `auth.uid()`, reject unauthenticated execution, and expose execution only to `authenticated`.

The server-rendered dashboard calls a question service that ensures initialization and then reads the buyer's ordered rows through existing RLS. Static list rendering stays in an Astro component. A small Solid island owns the destructive browser confirmation. Its form posts to a protected, zod-validated reset endpoint, which calls the same service boundary and redirects back to the dashboard with a success or generic retryable error state.

## Critical Implementation Details

- "Uninitialized" means the authenticated buyer has no rows in `buyer_questions`. Any existing row makes initialization a no-op.
- The initialization and reset functions must serialize per buyer. Without a buyer-scoped transaction lock, concurrent first visits can race against the unique `(buyer_id, position)` constraint and surface avoidable failures.
- Both operations must copy only templates that are active at execution time and preserve `question_type`, `text`, `position`, and `source_template_id`.
- Reset is intentionally destructive. The confirmation must state that every current question, including future personal questions, will be removed.
- Security-definer functions must use an explicit safe `search_path`, derive the buyer ID only from `auth.uid()`, and have public/anonymous execution revoked.
- The dashboard must stop after an initialization failure rather than reading and displaying a potentially pre-existing partial list as a successful initialization.

## Phase 1: Align the Contract and Add Atomic Lifecycle Operations

### Overview

Replace the obsolete account-creation requirement and establish the database operations that own lazy initialization and destructive reset.

### Changes Required

#### 1. Product requirement alignment

**Files**: `context/foundation/prd.md`, `context/foundation/shape-notes.md`, `context/foundation/roadmap.md`

**Intent**: Make first question-list visit the canonical provisioning moment and document the explicit destructive reset behavior.

**Contract**:

- FR-002 and Access Control state that the fixed list is copied when an authenticated buyer first opens their question base, not on account creation.
- Repeat visits preserve an initialized personal copy; template changes do not synchronize automatically.
- The buyer can explicitly reset the entire personal list to the currently active template document after confirmation.
- S-01 outcome and risk describe lazy initialization plus visible list review without changing its prerequisite chain.

#### 2. Question-base lifecycle migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_add_question_base_lifecycle_functions.sql`

**Intent**: Provide atomic, retry-safe, owner-bound operations for creating and resetting a buyer question base.

**Contract**:

- Add authenticated RPC functions named `ensure_buyer_question_base()` and `reset_buyer_question_base()`.
- Both functions reject a missing `auth.uid()`, serialize mutations per buyer, and copy only active templates.
- Ensure performs no mutation when the buyer already owns any question row.
- Reset deletes every row owned by the current buyer before recreating the active template copy.
- Copies preserve source template ID, type, text, and position.
- Functions run atomically, use a safe explicit `search_path`, revoke execution from `public` and `anon`, and grant execution only to `authenticated`.

#### 3. Lifecycle pgTAP contract

**File**: `supabase/tests/database/question_base_lifecycle.test.sql`

**Intent**: Make lazy initialization, reset, and isolation executable regression contracts.

**Contract**:

- Anonymous calls are denied.
- A buyer with no rows receives exactly the active template document with preserved provenance and ordering.
- A repeated ensure call leaves the initialized copy unchanged.
- A buyer account that existed before the migration can initialize on its first dashboard-equivalent call.
- Inactive templates are excluded from initialization and reset.
- Existing buyer rows make ensure a no-op.
- Reset removes copied and personal rows, then recreates exactly the active template document.
- One buyer's ensure or reset never changes another buyer's rows.

### Success Criteria

#### Automated Verification

- `pnpm exec supabase db reset` applies the lifecycle migration from a clean local database.
- `pnpm exec supabase test db supabase/tests/database/question_base_lifecycle.test.sql` passes.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review the foundation documents and confirm no active requirement still promises copy-on-account-creation behavior.
- Review the migration and confirm initialization and reset derive ownership only from `auth.uid()` and cannot leave a partial copy.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Render the Lazily Initialized Question Base

### Overview

Turn the protected dashboard into the buyer-visible question-base page and initialize the personal copy on first visit.

### Changes Required

#### 1. Shared question DTO

**File**: `src/types.ts`

**Intent**: Define the stable application shape consumed by the service and static list renderer.

**Contract**: Export the buyer-question DTO with ID, source template ID, type, text, and position. Its type values remain exactly `category` and `open_question`.

#### 2. Server question service

**File**: `src/lib/services/questions.ts`

**Intent**: Keep database lifecycle and ordered-read behavior out of route and page components.

**Contract**:

- Expose a server-only operation that calls `ensure_buyer_question_base()` and, only after success, reads the current buyer's rows ordered by `position`.
- Return a small explicit success/error result suitable for server rendering.
- Keep reset support behind the same service boundary for Phase 3.
- Rely on the request-scoped authenticated Supabase client and database RLS; do not accept a caller-supplied buyer ID.

#### 3. Flat ordered question renderer

**File**: `src/components/questions/QuestionBaseList.astro`

**Intent**: Render the buyer's personal document without converting positional categories into a separate relational grouping model.

**Contract**:

- Render every buyer row once in ascending position order.
- Present `category` rows as visually distinct bold headings while retaining their place in the flat sequence.
- Present `open_question` rows as normal question items.
- Keep the component static Astro because no list interaction is required in this phase.

#### 4. Buyer question-base dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the starter placeholder with the first complete buyer-visible question-base experience.

**Contract**:

- Use `Astro.locals.user` and a request-scoped Supabase client.
- Ensure the question base before reading and rendering it.
- Render the ordered list, buyer identity, and existing sign-out action.
- On configuration, initialization, or read failure, show a generic retryable error and do not present a partial list as successful.
- Keep successful sign-in redirect behavior unchanged.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes.
- `pnpm exec supabase test db` passes the full database suite.

#### Manual Verification

- With local Supabase and `pnpm run dev`, create or use an authenticated buyer with no question rows and open `/dashboard`; confirm the full personal copy is created and displayed.
- Reload `/dashboard` repeatedly and confirm row count, provenance, content, and positions do not change.
- Confirm category rows remain in the flat sequence and are visually presented as headings or bold rows.
- Force an unavailable/misconfigured Supabase path and confirm the dashboard shows a retryable error rather than a partial or empty-success state.

**Implementation Note**: After automated and manual verification pass, pause for human confirmation before Phase 3.

---

## Phase 3: Add Destructive Reset and Verify the Complete Flow

### Overview

Expose the chosen destructive reset behavior through a confirmed UI action and protected server endpoint, then document and manually verify the complete flow.

### Changes Required

#### 1. Zod request-validation dependency

**Files**: `package.json`, `pnpm-lock.yaml`, `package-lock.json`

**Intent**: Follow the repository contract that API request input is validated with zod.

**Contract**: Add zod as a direct runtime dependency and keep both lockfiles aligned for pnpm development and npm-based CI.

#### 2. Reset confirmation island

**File**: `src/components/questions/ResetQuestionBaseForm.tsx`

**Intent**: Require explicit browser confirmation before submitting the destructive reset.

**Contract**:

- Render a reset button and native POST form targeting `/api/questions/reset`.
- Ask for confirmation before submission and clearly state that every current question will be deleted and replaced.
- Submit the expected confirmation value for server-side zod validation.
- Do not mutate Supabase directly from the browser.

#### 3. Protected reset endpoint

**Files**: `src/pages/api/questions/reset.ts`, `src/middleware.ts`

**Intent**: Execute reset through the authenticated server path and return the buyer to the dashboard with clear outcome state.

**Contract**:

- Export uppercase `POST` and `const prerender = false`.
- Protect the question API route through middleware and use `context.locals.user` as the auth boundary.
- Parse and validate form input with zod before calling the question service.
- Call the atomic reset RPC through the request-scoped Supabase client.
- Redirect to `/dashboard` with a success marker after reset or a generic retryable error marker after failure.

#### 4. Reset feedback and operating guidance

**Files**: `src/pages/dashboard.astro`, `README.md`

**Intent**: Make reset consequences and operational behavior understandable to buyers and contributors.

**Contract**:

- Dashboard renders reset success or failure feedback without exposing raw database errors.
- README describes lazy first-visit initialization, no automatic synchronization, destructive reset, and the manual dashboard verification flow.

### Success Criteria

#### Automated Verification

- `pnpm exec supabase db reset` succeeds from a clean local database.
- `pnpm exec supabase test db` passes the complete database suite.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- On an initialized dashboard, cancel reset and confirm no rows change.
- Add or alter a buyer row through local Supabase, confirm reset, and verify every prior row is removed and replaced by the current active template document.
- Confirm reset success feedback appears and the refreshed flat list is complete and ordered.
- Simulate an expired session or reset failure and confirm the request cannot reset another buyer's rows and returns a safe retryable outcome.
- Confirm successful sign-in still redirects to `/`, and navigating to `/dashboard` initializes or displays the buyer's personal list.

**Implementation Note**: After automated and manual verification pass, pause for final human confirmation before closing the change.

---

## Testing Strategy

### Database Tests

- Use pgTAP role/JWT contexts for anonymous, buyer A, and buyer B.
- Verify lazy initialization, idempotency, active-template filtering, destructive reset, provenance, ordering, and cross-buyer isolation.
- Keep lifecycle fixtures inside transactions.

### Application Verification

- No application test runner exists; do not introduce one for this slice.
- Use `pnpm run lint` and `pnpm run build` as automated repository gates.
- Run `pnpm run dev` with local Supabase and manually verify first visit, repeat visit, list presentation, confirmation cancel, successful reset, failure state, and preserved sign-in redirect.

## Performance Considerations

- The template document is small, and initialization/reset are infrequent buyer-scoped writes. A single transactional copy is appropriate.
- Buyer rows are already indexed by the unique `(buyer_id, position)` constraint, supporting the dashboard's owner-filtered ordered read.
- The buyer-scoped transaction lock prevents duplicate concurrent initialization without serializing unrelated buyers.
- Do not add caching, pagination, background jobs, or client-side state management.

## Migration Notes

- Add a new migration; do not edit the applied F-01 migrations.
- The migration adds functions and grants only. It performs no deployment-time backfill and does not mutate existing buyer rows.
- Existing auth accounts initialize lazily when they first open `/dashboard`.
- Existing buyer rows are preserved by ensure and replaced only by an explicit confirmed reset.
- Hosted Supabase migration remains a separate human-approved deployment from the Cloudflare Worker.
- If the new Worker code must be rolled back, the lifecycle functions can remain without affecting older code. Remove or change them only through a reviewed forward migration.

## References

- Change identity: `context/changes/buyer-account-question-base/change.md`
- Roadmap slice: `context/foundation/roadmap.md:88`
- Existing FR-002 requirement: `context/foundation/prd.md:71`
- Existing Access Control requirement: `context/foundation/prd.md:108`
- Ownership schema and policies: `supabase/migrations/20260604211412_create_question_ownership_contract.sql`
- Canonical templates: `supabase/migrations/20260604220000_insert_polish_question_templates.sql`
- Existing ownership tests: `supabase/tests/database/question_ownership_contract.test.sql`
- Auth middleware: `src/middleware.ts`
- Protected dashboard: `src/pages/dashboard.astro`
- Request-scoped Supabase client: `src/lib/supabase.ts`
- Preserved sign-in redirect: `src/pages/api/auth/signin.ts`
- Repository verification commands: `package.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Align the Contract and Add Atomic Lifecycle Operations

#### Automated

- [ ] 1.1 `pnpm exec supabase db reset` applies the lifecycle migration from a clean local database.
- [ ] 1.2 `pnpm exec supabase test db supabase/tests/database/question_base_lifecycle.test.sql` passes.
- [ ] 1.3 `pnpm run lint` passes.
- [ ] 1.4 `pnpm run build` passes.

#### Manual

- [ ] 1.5 Review the foundation documents and confirm no active requirement still promises copy-on-account-creation behavior.
- [ ] 1.6 Review the migration and confirm initialization and reset derive ownership only from `auth.uid()` and cannot leave a partial copy.

### Phase 2: Render the Lazily Initialized Question Base

#### Automated

- [ ] 2.1 `pnpm run lint` passes.
- [ ] 2.2 `pnpm run build` passes.
- [ ] 2.3 `pnpm exec supabase test db` passes the full database suite.

#### Manual

- [ ] 2.4 With local Supabase and `pnpm run dev`, create or use an authenticated buyer with no question rows and open `/dashboard`; confirm the full personal copy is created and displayed.
- [ ] 2.5 Reload `/dashboard` repeatedly and confirm row count, provenance, content, and positions do not change.
- [ ] 2.6 Confirm category rows remain in the flat sequence and are visually presented as headings or bold rows.
- [ ] 2.7 Force an unavailable/misconfigured Supabase path and confirm the dashboard shows a retryable error rather than a partial or empty-success state.

### Phase 3: Add Destructive Reset and Verify the Complete Flow

#### Automated

- [ ] 3.1 `pnpm exec supabase db reset` succeeds from a clean local database.
- [ ] 3.2 `pnpm exec supabase test db` passes the complete database suite.
- [ ] 3.3 `pnpm run lint` passes.
- [ ] 3.4 `pnpm run build` passes.

#### Manual

- [ ] 3.5 On an initialized dashboard, cancel reset and confirm no rows change.
- [ ] 3.6 Add or alter a buyer row through local Supabase, confirm reset, and verify every prior row is removed and replaced by the current active template document.
- [ ] 3.7 Confirm reset success feedback appears and the refreshed flat list is complete and ordered.
- [ ] 3.8 Simulate an expired session or reset failure and confirm the request cannot reset another buyer's rows and returns a safe retryable outcome.
- [ ] 3.9 Confirm successful sign-in still redirects to `/`, and navigating to `/dashboard` initializes or displays the buyer's personal list.
