# Saved Pasted Offer Implementation Plan

## Overview

Deliver the saved-offer workspace required before extraction can run. An authenticated buyer can open a dedicated offers area, create a private flat offer with a title, pasted offer-page content, and optional source URL, revisit the saved detail, and hard-delete the offer after confirmation.

This slice intentionally stops before extraction. It stores the buyer-provided source material and proves the ownership boundary so S-03 can later attach extracted answers, unanswered questions, doubtful facts, and unmapped information to a trusted offer record.

## Current State Analysis

S-01 is complete. The app resolves the authenticated user in `src/middleware.ts`, protects `/dashboard` and `/api/questions`, initializes buyer questions through server-side services, and uses zod-validated API routes for mutations. The database already has RLS-tested buyer-owned question tables and lifecycle functions.

There is no offer persistence yet. `src/types.ts` only describes question-related tables, `src/lib/services/` has no offer service, `src/pages/` has no `/offers` routes, and the dashboard is focused on the question base. The roadmap defines S-02 as the prerequisite for S-03 and flags the main risk: pasted offer content is sensitive, so persistence must land with ownership checks and deletion.

### Key Discoveries

- The PRD requires creating a flat offer entry, pasting offer-page content into it, keeping pasted content private to the logged-in buyer, and allowing deletion (`context/foundation/prd.md`).
- The roadmap scopes S-02 to create, delete, and revisit a private flat offer containing pasted offer-page content (`context/foundation/roadmap.md`).
- Middleware already provides the request user and route protection pattern (`src/middleware.ts`).
- Mutation routes already use uppercase handlers, `prerender = false`, server clients, zod validation, and redirect-based feedback (`src/pages/api/questions/reset.ts`).
- Database ownership tests already use pgTAP role/JWT contexts for anonymous and multiple buyers (`supabase/tests/database/question_base_lifecycle.test.sql`).
- There is no application test runner; UI and auth flows require manual browser verification.

## Desired End State

- Authenticated buyers can navigate to `/offers` from the dashboard and see their saved offers newest-updated first.
- Buyers can open `/offers/new`, submit a required title, required pasted content, and optional source URL, then land on the saved offer detail.
- Offer detail shows the read-only title, optional source URL, pasted content, timestamps, and a confirmed delete action.
- Delete is a hard delete. Once confirmed, the offer row is removed immediately and the buyer returns to the list with safe feedback.
- Buyers can only read, create, and delete their own offers. Anonymous users cannot access offer routes or tables.
- No edit, extraction, comparison, scoring, or structured flat-attribute UI is added in this slice.

## What We're NOT Doing

- Extracting answers, unanswered questions, doubtful facts, or unmapped information.
- Adding structured offer attributes such as address, price, area, room count, seller, or building details.
- Editing title, URL, or pasted content after creation.
- Autosaving drafts, recovering deleted offers, soft delete/archive, or undo.
- Importing from links, crawling offer pages, or validating source content against external pages.
- Comparing offers or adding notes to offers.
- Adding a client-side offer state store or an application test runner.
- Changing sign-in redirect behavior or moving the existing question-base dashboard.

## Implementation Approach

Add a `flat_offers` table with buyer ownership, nonblank title/content constraints, optional source URL, timestamps, RLS, and explicit operation policies. Keep update intentionally denied at the database and application level for this slice, even though the table has `updated_at` for stable newest-updated ordering and future edits.

Add an offer service beside the question service. The service accepts a request-scoped Supabase client, never a caller-supplied buyer ID, and exposes list, create, detail, and delete operations as small success/error results. Server-rendered Astro pages own list, create, and detail rendering. API routes own create and delete mutations, validate input with zod, and redirect with generic success/error query markers. A small Solid delete form provides browser confirmation without direct browser Supabase access.

## Critical Implementation Details

- `source_url` is optional. Blank form input becomes `null`; nonblank input must be a valid absolute URL before insertion.
- `title` and `pasted_content` are required after trimming. Do not store whitespace-only records.
- List ordering is `updated_at desc`, with a deterministic tie-breaker such as `created_at desc` or `id desc`.
- The table must define explicit SELECT, INSERT, UPDATE, and DELETE policy behavior for authenticated buyers. UPDATE remains denied because editing is out of scope.
- Route handlers and services must not accept or trust a buyer ID from the client. Ownership comes from the session and RLS.
- Detail and delete behavior should treat inaccessible and missing offer IDs the same in user-facing output.

## Phase 1: Establish Offer Persistence and Ownership

### Overview

Create the durable database contract for private saved offers and prove anonymous denial, cross-buyer isolation, owner creation, owner reads, denied updates, and owner hard delete.

### Changes Required

#### 1. Saved offer schema and RLS migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_create_flat_offers.sql`

**Intent**: Add the buyer-owned table that stores pasted offer source material for later extraction.

**Contract**:

- Create `public.flat_offers`.
- Columns include `id`, `buyer_id`, `title`, `source_url`, `pasted_content`, `created_at`, and `updated_at`.
- `buyer_id` references `auth.users(id)` with `ON DELETE CASCADE` and defaults to `auth.uid()` for authenticated inserts.
- `title` and `pasted_content` cannot be blank.
- `source_url` is nullable and cannot be blank when present.
- Add a trigger or equivalent mechanism to refresh `updated_at` on future updates.
- Add indexes supporting owner-scoped newest-updated list queries.
- Enable RLS.
- Authenticated buyers can SELECT and DELETE only their own rows.
- Authenticated buyers can INSERT only owner-bound rows.
- Authenticated UPDATE is explicitly denied for this slice.
- Anonymous users have no table access.
- Apply only the grants needed for intended behavior: revoke all table privileges from `public`, `anon`, and `authenticated`; grant `select` and `delete` on `flat_offers` to `authenticated`; grant `insert (title, source_url, pasted_content)` on `flat_offers` to `authenticated`; grant no `update` privilege.
- Direct clients cannot insert `buyer_id`, `created_at`, or `updated_at`; those values remain database-owned.

#### 2. Saved offer pgTAP ownership tests

**File**: `supabase/tests/database/flat_offers_contract.test.sql`

**Intent**: Turn the offer privacy and mutation contract into an executable regression suite.

**Contract**:

- Verify the table, key columns, constraints, indexes, trigger function, and RLS are present.
- Verify anonymous users cannot read, insert, update, or delete offers.
- Verify buyer A can insert a valid offer and read only buyer A rows.
- Verify buyer A cannot insert client-controlled `buyer_id`, `created_at`, or `updated_at` values.
- Verify buyer B cannot read, update, or delete buyer A rows.
- Verify title and pasted content reject blank values.
- Verify blank `source_url` is rejected when inserted directly, while `null` is accepted.
- Verify authenticated UPDATE is denied even for the owner.
- Verify owner DELETE hard-deletes the row.
- Verify deleting an `auth.users` row cascades that buyer's offers without affecting another buyer.

#### 3. Shared database and app types

**File**: `src/types.ts`

**Intent**: Expose the stable database and application DTO shapes used by the offer service and pages.

**Contract**:

- Add the `flat_offers` table shape to `Database`.
- Export a `FlatOffer` or `SavedOffer` DTO with ID, title, source URL, pasted content, created timestamp, and updated timestamp.
- Keep database snake_case and app-facing camelCase separated by service mapping.

### Success Criteria

#### Automated Verification

- `pnpm exec supabase db reset` applies the new migration from a clean local database.
- `pnpm exec supabase test db supabase/tests/database/flat_offers_contract.test.sql` passes.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review the migration and confirm `flat_offers` has RLS enabled plus explicit SELECT, INSERT, UPDATE, and DELETE behavior.
- Review the pgTAP negative cases and confirm they prove anonymous denial, cross-buyer isolation, denied owner update, and hard delete.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Add the Server-Rendered Saved Offer Flow

### Overview

Expose the dedicated `/offers` workspace with list, create, detail, and confirmed hard-delete behavior using the database contract from Phase 1.

### Changes Required

#### 1. Offer service boundary

**File**: `src/lib/services/offers.ts`

**Intent**: Keep offer persistence, mapping, and error handling out of pages and API routes.

**Contract**:

- Expose operations for listing current buyer offers, creating an offer, loading one offer by ID, and deleting one offer by ID.
- Use the request-scoped Supabase client and database RLS; do not accept a buyer ID parameter.
- Return small explicit success/error results suitable for server rendering and redirect decisions.
- List offers newest-updated first with deterministic tie-breaking.
- Map database rows into the shared offer DTO.

#### 2. Route protection

**File**: `src/middleware.ts`

**Intent**: Require authentication for all saved-offer pages and mutation routes.

**Contract**:

- Add `/offers` and `/api/offers` to the protected route set.
- Continue resolving `context.locals.user` on every request.
- Preserve existing question and auth behavior.

#### 3. Offer list page

**Files**: `src/pages/offers/index.astro`, optional `src/components/offers/OfferList.astro`

**Intent**: Give buyers a dedicated place to revisit saved offers and start a new one.

**Contract**:

- Render the signed-in buyer identity or reuse existing header conventions.
- Show saved offers newest-updated first with title, optional source URL, and updated timestamp.
- Include a clear link to `/offers/new`.
- Show empty state when the buyer has no offers.
- Show safe success/error feedback for create and delete redirects.
- Do not render offers owned by another buyer.

#### 4. Offer create page and API route

**Files**: `src/pages/offers/new.astro`, `src/pages/api/offers/create.ts`

**Intent**: Let the buyer save one pasted offer through a server-rendered form.

**Contract**:

- The page renders required title and pasted-content inputs plus optional source URL.
- The API route exports uppercase `POST` and `const prerender = false`.
- Validate form input with zod.
- Trim title and content.
- Convert blank source URL to `null`; validate nonblank source URL as an absolute URL.
- On success, redirect to `/offers/[id]?created=success`.
- On validation or persistence failure, redirect back to `/offers/new` with a generic error marker. Do not expose raw database errors.

#### 5. Offer detail page

**File**: `src/pages/offers/[id].astro`

**Intent**: Let buyers inspect exactly what they saved before extraction exists.

**Contract**:

- Load one offer by ID through the offer service.
- Render read-only title, optional source URL, pasted content, created timestamp, updated timestamp, and delete action.
- Show safe not-found or retryable error UI when the row is missing or inaccessible.
- Do not add extraction placeholders or editable fields.

#### 6. Confirmed hard delete

**Files**: `src/components/offers/DeleteOfferForm.tsx`, `src/pages/api/offers/[id]/delete.ts`

**Intent**: Satisfy the deletion requirement without retaining sensitive pasted content.

**Contract**:

- The Solid form asks for browser confirmation before submitting.
- The API route exports uppercase `POST` and `const prerender = false`.
- Validate the route ID and hidden confirmation value with zod.
- Delete through the offer service.
- Redirect to `/offers?deleted=success` on success.
- Redirect to the detail page or list with a generic error marker on failure.
- Treat inaccessible and missing IDs as safe failures; never reveal whether another buyer's offer exists.

#### 7. Navigation and documentation

**Files**: `src/pages/dashboard.astro`, `README.md`

**Intent**: Make the saved-offer workspace discoverable and document the local manual verification path.

**Contract**:

- Add a link from the dashboard to `/offers` without replacing the question-base experience.
- README describes saved pasted offers, hard delete, no editing, no extraction in S-02, and manual browser verification.

### Success Criteria

#### Automated Verification

- `pnpm exec supabase db reset` succeeds from a clean local database.
- `pnpm exec supabase test db` passes the complete database suite.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- With local Supabase and `pnpm run dev`, sign in and open `/offers`; confirm an empty state appears for a buyer with no offers.
- Create an offer with title, pasted content, and source URL; confirm redirect to detail and read-only saved content.
- Create an offer without a source URL; confirm the detail page handles the missing URL cleanly.
- Submit invalid create input and confirm a generic retryable error appears without saving a row.
- Return to `/offers` and confirm offers are listed newest-updated first.
- Open the detail page repeatedly and confirm it does not mutate the saved row.
- Cancel delete and confirm the offer remains.
- Confirm delete and verify the row disappears from the list and from direct detail access.
- Sign in as another buyer or simulate another buyer locally and confirm they cannot see or delete the first buyer's offers.
- Confirm `/offers`, `/offers/new`, offer detail, and `/api/offers/**` redirect unauthenticated users to sign in.

**Implementation Note**: After automated and manual verification pass, pause for final human confirmation before closing the change.

---

## Testing Strategy

### Database Tests

- Use pgTAP role/JWT contexts for anonymous, buyer A, and buyer B.
- Verify schema shape, constraints, grants, RLS, owner insert/read/delete, denied update, cross-buyer isolation, and account-deletion cascade.
- Keep test fixtures inside transactions.

### Application Verification

- No application test runner exists; do not introduce one for this slice.
- Use `pnpm run lint` and `pnpm run build` as automated repository gates.
- Use local Supabase plus `pnpm run dev` for browser checks across list, create, detail, delete cancel, delete confirm, validation failure, missing URL, and unauthenticated redirects.

## Performance Considerations

- MVP data volume is small. Owner-scoped list reads ordered by `updated_at desc` are enough.
- Store pasted content as `text`; do not add full-text search, pagination, compression, background jobs, or caching.
- Keep source URL validation in the API route rather than adding external network checks.
- Future extraction can attach to `flat_offers.id`; do not prebuild extraction tables here.

## Migration Notes

- Add a new timestamped migration; do not edit applied question migrations.
- The migration is additive and creates a new product table with no backfill.
- `ON DELETE CASCADE` from `auth.users` removes a deleted buyer's offers.
- Future extraction-result tables should reference `flat_offers(id)` and cascade or otherwise explicitly handle offer deletion.
- Hosted Supabase migration remains a separate human-approved deployment from the Cloudflare Worker.
- If Worker code rolls back after this migration, the unused table can remain safely. Remove or change it only through a reviewed forward migration once shared environments exist.

## References

- Change identity: `context/changes/saved-pasted-offer/change.md`
- Roadmap slice: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd.md`
- Auth middleware: `src/middleware.ts`
- Existing question service pattern: `src/lib/services/questions.ts`
- Existing protected mutation pattern: `src/pages/api/questions/reset.ts`
- Existing database lifecycle test pattern: `supabase/tests/database/question_base_lifecycle.test.sql`
- Repository verification commands: `package.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish Offer Persistence and Ownership

#### Automated

- [x] 1.1 `pnpm exec supabase db reset` applies the new migration from a clean local database. - 38f2b73
- [x] 1.2 `pnpm exec supabase test db supabase/tests/database/flat_offers_contract.test.sql` passes. - 38f2b73
- [x] 1.3 `pnpm run lint` passes. - 38f2b73
- [x] 1.4 `pnpm run build` passes. - 38f2b73

#### Manual

- [x] 1.5 Review the migration and confirm `flat_offers` has RLS enabled plus explicit SELECT, INSERT, UPDATE, and DELETE behavior. - 38f2b73
- [x] 1.6 Review the pgTAP negative cases and confirm they prove anonymous denial, cross-buyer isolation, denied owner update, and hard delete. - 38f2b73

### Phase 2: Add the Server-Rendered Saved Offer Flow

#### Automated

- [x] 2.1 `pnpm exec supabase db reset` succeeds from a clean local database. - 00edaef
- [x] 2.2 `pnpm exec supabase test db` passes the complete database suite. - 00edaef
- [x] 2.3 `pnpm run lint` passes. - 00edaef
- [x] 2.4 `pnpm run build` passes. - 00edaef

#### Manual

- [x] 2.5 With local Supabase and `pnpm run dev`, sign in and open `/offers`; confirm an empty state appears for a buyer with no offers. - manual verification 2026-06-08
- [x] 2.6 Create an offer with title, pasted content, and source URL; confirm redirect to detail and read-only saved content. - manual verification 2026-06-08
- [x] 2.7 Create an offer without a source URL; confirm the detail page handles the missing URL cleanly. - manual verification 2026-06-08
- [x] 2.8 Submit invalid create input and confirm a generic retryable error appears without saving a row. - manual verification 2026-06-08
- [x] 2.9 Return to `/offers` and confirm offers are listed newest-updated first. - manual verification 2026-06-08
- [x] 2.10 Open the detail page repeatedly and confirm it does not mutate the saved row. - manual verification 2026-06-08
- [x] 2.11 Cancel delete and confirm the offer remains. - manual verification 2026-06-08
- [x] 2.12 Confirm delete and verify the row disappears from the list and from direct detail access. - manual verification 2026-06-08
- [x] 2.13 Sign in as another buyer or simulate another buyer locally and confirm they cannot see or delete the first buyer's offers. - manual verification 2026-06-08
- [x] 2.14 Confirm `/offers`, `/offers/new`, offer detail, and `/api/offers/**` redirect unauthenticated users to sign in. - manual verification 2026-06-08
