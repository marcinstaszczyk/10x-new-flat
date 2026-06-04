# Buyer Data Ownership Contract Implementation Plan

## Overview

Establish the first product persistence contract for buyer-owned questions and the fixed base-question source. The change introduces a document-like ordered question model, ships a comprehensive Polish flat-viewing question list, and proves with database tests that authenticated buyers cannot access or mutate another buyer's data.

## Current State Analysis

The application currently uses Supabase only for authentication. There are no product tables, migrations, seed data, generated database types, or database tests. The server-side Supabase client uses the configured anon key and the current user's cookies, so PostgreSQL row-level security must be the durable ownership boundary.

The roadmap requires F-01 to put minimal buyer-owned persistence rules and a fixed base-question source in place before S-01 copies that source into a buyer account. The copy operation itself, question-management UI, offers, extraction results, and notes belong to later roadmap slices.

## Desired End State

The repository contains versioned Supabase migrations defining:

- A read-only `question_templates` source containing a comprehensive Polish flat-viewing question list.
- A buyer-owned `buyer_questions` table suitable for copied template rows and personal additions.
- An ordered row model where `question_type` distinguishes `category` headers from `open_question` rows, allowing both grouped and completely flat lists.
- Explicit RLS policies granting authenticated buyers full CRUD only on their own `buyer_questions`, while authenticated users may read only active templates.
- Cascading cleanup of buyer questions when the corresponding `auth.users` row is deleted.

Executable pgTAP tests prove the schema and access-control contract. The existing Astro application continues to lint and build without implementing S-01 or any question UI.

### Key Discoveries:

- F-01 is the first dependency in the buyer-owned preparation stream and must be complete before S-01, S-02, and S-04 can be safely implemented (`context/foundation/roadmap.md:60`).
- The PRD requires a fixed question list copied per buyer and requires saved buyer data to remain private (`context/foundation/prd.md:71`, `context/foundation/prd.md:94`, `context/foundation/prd.md:108`).
- The current Supabase helper creates a session-aware server client using the anon key, making RLS the required authorization boundary (`src/lib/supabase.ts:1`).
- The current signup endpoint creates only the auth user; copying templates remains a later S-01 responsibility (`src/pages/api/auth/signup.ts:4`).
- Supabase migrations and seed support are enabled, but no migration or `seed.sql` currently exists (`supabase/config.toml:53`).
- Database rollback is operationally separate from Cloudflare code rollback, so the migration must be additive and forward-fixable (`context/foundation/infrastructure.md:62`).

## What We're NOT Doing

- Copying template rows into `buyer_questions` during signup or first login.
- Adding question CRUD services, API routes, server-rendered pages, or interactive UI.
- Adding offers, extracted results, personal notes, or their ownership policies.
- Adding separate category tables or explicit category foreign keys.
- Adding closed questions, answer options, scoring, or answer evaluation.
- Adding an admin UI or client-side mutations for `question_templates`.
- Adding synchronization from later template revisions into existing buyer copies.
- Generating Supabase TypeScript types before application code consumes the schema.

## Implementation Approach

Use two versioned migrations and focused pgTAP test files. The first migration establishes the stable schema and RLS contract. The second migration contains the complete Polish product content so content revisions remain reviewable independently from schema changes. Database tests authenticate as anonymous and multiple buyer identities to verify positive and negative policy behavior. Documentation replaces the starter's claim that no database migrations are required with the actual local reset and test workflow.

## Critical Implementation Details

Category membership is intentionally positional rather than relational: a `category` row is a display header, and following `open_question` rows belong visually to it until another category row appears. Deleting a category row deletes only that header; following questions remain in their existing order and render as uncategorized until the next category. The schema must not encode implicit membership that would cause header deletion to mutate or delete question rows.

The phrase "full Polish list" is a product-content deliverable inside this change. Before inserting rows, the implementer must research a comprehensive flat-viewing checklist, remove duplicates, keep questions open-ended, and review coverage against the acceptance categories below. The migration remains the canonical production source; `seed.sql` must not become the source of truth.

## Phase 1: Establish Schema and Ownership Rules

### Overview

Create the minimal two-table persistence contract, constraints, indexes, grants, and explicit RLS policies without adding application behavior.

### Changes Required:

#### 1. Question schema and row contracts

**File**: `supabase/migrations/YYYYMMDDHHmmss_create_question_ownership_contract.sql`

**Intent**: Define the global template source and buyer-owned question list as ordered document rows. Preserve template provenance for copied rows while allowing buyers to add rows that have no template source.

**Contract**:

- Define a stable database type or equivalent check constraint whose initial allowed values are exactly `category` and `open_question`.
- `question_templates` contains a stable ID, `question_type`, Polish `text`, deterministic `position`, active status, and creation timestamp.
- `buyer_questions` contains a stable ID, non-null `buyer_id` referencing `auth.users(id)` with `ON DELETE CASCADE`, nullable `source_template_id`, `question_type`, `text`, deterministic buyer-level `position`, and creation/update timestamps.
- `source_template_id` references `question_templates(id)` with `ON DELETE RESTRICT`; referenced templates are retired through active status rather than deleted, preserving provenance and every buyer's independent copy.
- Text cannot be blank, positions cannot be negative, and each table has a uniqueness rule preventing ambiguous ordering within its own list.
- Index ownership and ordering columns used by expected buyer-list queries.

#### 2. RLS policies and grants

**File**: `supabase/migrations/YYYYMMDDHHmmss_create_question_ownership_contract.sql`

**Intent**: Make PostgreSQL enforce privacy independently from application routes. Template content is readable but immutable to authenticated clients; buyer rows are visible and mutable only by their owner.

**Contract**:

- Enable RLS on both tables.
- `question_templates`: authenticated users may `SELECT` rows only when active; no authenticated client policy permits INSERT, UPDATE, or DELETE.
- `buyer_questions`: define explicit SELECT, INSERT, UPDATE, and DELETE policies using `auth.uid() = buyer_id`; both update visibility and the resulting row must remain owner-bound.
- Anonymous users have no access to either table.
- Apply only the grants required for the policies to work; do not grant a client path that bypasses the intended policy behavior.

#### 3. Canonical content-source configuration

**File**: `supabase/config.toml`

**Intent**: Remove the obsolete reference to the missing `supabase/seed.sql` and make migrations the only source used to load the fixed question list.

**Contract**: Disable database seeding or clear its SQL paths so `db reset` applies the versioned schema/content history without a second, divergent content source.

#### 4. Supabase CLI preflight and sandbox workaround

**File**: Local shell environment only

**Intent**: Make database verification executable from Phase 1 rather than deferring a known Windows sandbox failure until Phase 3.

**Contract**:

- Before the first database command, verify the pinned local Supabase CLI runs.
- In the Windows sandbox, set `USERPROFILE` to the repository root for Supabase CLI invocations when the CLI cannot write telemetry under the normal profile.
- Do not commit workspace-local `.supabase/` telemetry or trace artifacts created by the workaround.
- Keep normal contributor commands portable; do not add a wrapper or dependency solely for the sandbox workaround.

### Success Criteria:

#### Automated Verification:

- The schema migration applies cleanly from an empty local database with `.\node_modules\.bin\supabase.CMD db reset`.
- `pnpm.cmd run lint` passes.
- `pnpm.cmd run build` passes.

#### Manual Verification:

- Review the migration and confirm every product table has RLS enabled and explicit policies for each permitted authenticated operation.
- Confirm the schema can represent a list with category headers, a list with no category headers, and copied rows with preserved template provenance.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation before proceeding to Phase 2.

---

## Phase 2: Ship the Full Polish Base-Question List

### Overview

Research, author, review, and migrate the canonical Polish question list that future S-01 work will copy into buyer accounts.

### Changes Required:

#### 1. Canonical Polish question content

**File**: `supabase/migrations/YYYYMMDDHHmmss_insert_polish_question_templates.sql`

**Intent**: Deliver a comprehensive, useful default checklist for a Polish buyer preparing to view a flat. Keep content readable in code review and deterministic across local, preview, and production environments.

**Contract**:

- Insert the complete list through a versioned migration, not only through `supabase/seed.sql`.
- Use `category` rows as optional section headers and `open_question` rows for prompts.
- All inserted text is Polish, buyer-facing, open-ended where appropriate, and free from duplicate questions.
- Positions are deterministic and unique across the entire template document.
- The list covers at minimum: stan prawny i dokumenty; budynek i otoczenie; lokal i układ; stan techniczny i instalacje; koszty i zarządzanie; remonty i wyposażenie; komunikacja, infrastruktura i codzienne użytkowanie; warunki sprzedaży and next steps.
- Include relevant uncategorized rows only when they genuinely belong outside every section; categories remain optional by contract, not mandatory by content quota.
- Content insertion is idempotent with respect to the stable template IDs chosen by the migration and does not depend on a local seed.

#### 2. Content provenance and maintenance guidance

**File**: `README.md`

**Intent**: Explain that question templates are product content delivered through migrations and that later edits must preserve existing buyer-copy independence.

**Contract**: Update the Supabase database setup section to identify the template migration as the canonical source and state that changes to template content require a new migration rather than editing already-applied history.

#### 3. Template-content pgTAP check

**File**: `supabase/tests/database/question_templates_content.test.sql`

**Intent**: Make the Phase 2 content verification persistent and runnable before the broader ownership suite lands.

**Contract**: Assert that template rows have nonblank text, allowed type values, unique positions, active status, both required row types, and coverage of every required content section.

### Success Criteria:

#### Automated Verification:

- A clean `.\node_modules\.bin\supabase.CMD db reset` loads the complete Polish list without migration errors.
- `.\node_modules\.bin\supabase.CMD test db supabase/tests/database/question_templates_content.test.sql` passes the deterministic template-content checks.
- `pnpm.cmd run lint` passes.
- `pnpm.cmd run build` passes.

#### Manual Verification:

- Review the full Polish list for practical coverage, duplicates, wording quality, and suitability during a flat viewing.
- Inspect the ordered list and confirm category headers improve navigation while removing all category rows would still leave a coherent flat question list.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human content approval before proceeding to Phase 3.

---

## Phase 3: Prove and Document the Contract

### Overview

Add executable database tests for schema behavior and RLS isolation, then document the supported local database workflow.

### Changes Required:

#### 1. pgTAP ownership and visibility tests

**File**: `supabase/tests/database/question_ownership_contract.test.sql`

**Intent**: Turn the buyer-data ownership rules into an executable regression contract. Test both allowed behavior and denied access using multiple simulated identities.

**Contract**:

- Verify both tables exist, RLS is enabled, expected constraints exist, and the template document contains active category and open-question rows.
- Verify anonymous users cannot read templates or buyer questions and cannot mutate either table.
- Verify an authenticated buyer can read active templates but cannot read inactive templates or mutate any template.
- Verify a buyer can SELECT, INSERT, UPDATE, and DELETE only their own `buyer_questions`.
- Verify cross-buyer SELECT, INSERT, UPDATE, and DELETE attempts cannot expose or modify another buyer's rows.
- Verify a buyer cannot change a row's `buyer_id` to another buyer.
- Verify deleting a referenced template is rejected while retiring it preserves buyer rows and provenance.
- Verify deleting a category row removes only that row and preserves following question rows and their positions.
- Verify deleting an `auth.users` record cascades to that buyer's question rows without affecting another buyer.

#### 2. Local database workflow documentation

**File**: `README.md`

**Intent**: Replace obsolete starter guidance and make the schema, content, and security checks repeatable for contributors.

**Contract**:

- Remove the statement that no database tables or migrations are required.
- Document local prerequisites, migration/reset command, database test command, and the fact that reset is destructive to local data.
- Identify `supabase/migrations/` as production schema/content history and `supabase/tests/database/` as the RLS contract.
- Keep hosted-project guidance accurate: schema migrations must be applied separately from Worker deployment and require human approval.
- Document the manual rollback and compatibility procedure for both initial migrations.

### Success Criteria:

#### Automated Verification:

- `.\node_modules\.bin\supabase.CMD db reset` succeeds from a clean local database.
- `.\node_modules\.bin\supabase.CMD test db` passes the ownership and visibility test suite.
- `pnpm.cmd run lint` passes.
- `pnpm.cmd run build` passes.

#### Manual Verification:

- Review the negative RLS cases and confirm the suite proves anonymous denial and cross-buyer isolation rather than only successful owner operations.
- Follow the README database setup and test steps from a clean local state and confirm they are sufficient and unambiguous.

**Implementation Note**: After completing this phase and all automated verification passes, pause for final human confirmation before closing the change.

---

## Testing Strategy

### Unit Tests:

- Use pgTAP assertions for table shape, constraints, RLS enablement, policy behavior, category-header deletion, and account-deletion cascade.
- Keep fixture users and rows inside test transactions so the suite leaves no persistent data.

### Integration Tests:

- Reset the complete local Supabase stack to prove schema migration order and canonical content loading.
- Execute Data API-equivalent role/JWT contexts for anonymous, buyer A, and buyer B to prove actual RLS outcomes.
- Run the existing application lint and production build to catch repository-level regressions.
- Accepted risk: database reset and pgTAP checks remain required local/manual gates in F-01; GitHub Actions database-test integration is deferred to a later change.

### Manual Testing Steps:

1. Inspect the full ordered Polish template list and approve its completeness and wording.
2. Inspect the migration policies against the four buyer CRUD operations and template read-only rule.
3. Follow README instructions on a clean local database and confirm reset and tests behave as documented.

## Performance Considerations

- Initial scale is small, but buyer list reads must use an index beginning with `buyer_id` and supporting deterministic position order.
- Template reads should support filtering active rows and ordering by position without application-side sorting ambiguity.
- Do not add full-text search, caching, pagination, or category-range indexes in this foundation change.

## Migration Notes

- Use additive, timestamped migrations under `supabase/migrations/`; never modify an applied migration after it has reached a shared environment.
- Keep schema creation separate from product-content insertion so later content revisions do not obscure ownership-contract changes.
- The initial migrations target an empty product schema. No product-data backfill is required because only `auth.users` exists today.
- Applying the schema/content migrations to hosted Supabase requires human approval and is separate from Cloudflare Worker deployment.
- Cloudflare rollback does not roll back Supabase. If a migration fails after deployment, use a reviewed forward-fix migration; do not rely on Worker rollback.
- Before applying migrations to hosted Supabase, document and review both rollback paths: drop the unused schema only while no consumer or buyer data exists; otherwise preserve compatibility and ship a forward-fix migration.
- Roll back erroneous template content through a new migration that retires affected templates; do not delete referenced templates or edit applied migration history.

## References

- Change identity: `context/changes/buyer-data-ownership-contract/change.md`
- Roadmap foundation: `context/foundation/roadmap.md:60`
- Product requirements: `context/foundation/prd.md:71`
- Access-control requirement: `context/foundation/prd.md:108`
- Infrastructure migration risk: `context/foundation/infrastructure.md:62`
- Current Supabase client: `src/lib/supabase.ts:1`
- Current auth creation path: `src/pages/api/auth/signup.ts:4`
- Supabase local configuration: `supabase/config.toml:53`
- Supabase RLS guide: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase database testing guide: `https://supabase.com/docs/guides/local-development/testing/overview`
- Supabase seeding guide: `https://supabase.com/docs/guides/local-development/seeding-your-database`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish Schema and Ownership Rules

#### Automated

- [x] 1.1 The schema migration applies cleanly from an empty local database with `.\node_modules\.bin\supabase.CMD db reset`. — 35edc0e
- [x] 1.2 `pnpm.cmd run lint` passes. — 35edc0e
- [x] 1.3 `pnpm.cmd run build` passes. — 35edc0e

#### Manual

- [x] 1.4 Review the migration and confirm every product table has RLS enabled and explicit policies for each permitted authenticated operation. — 35edc0e
- [x] 1.5 Confirm the schema can represent a list with category headers, a list with no category headers, and copied rows with preserved template provenance. — 35edc0e

### Phase 2: Ship the Full Polish Base-Question List

#### Automated

- [x] 2.1 A clean `.\node_modules\.bin\supabase.CMD db reset` loads the complete Polish list without migration errors. — 10b6f54
- [x] 2.2 `.\node_modules\.bin\supabase.CMD test db supabase/tests/database/question_templates_content.test.sql` passes the deterministic template-content checks. — 10b6f54
- [x] 2.3 `pnpm.cmd run lint` passes. — 10b6f54
- [x] 2.4 `pnpm.cmd run build` passes. — 10b6f54

#### Manual

- [x] 2.5 Review the full Polish list for practical coverage, duplicates, wording quality, and suitability during a flat viewing. — 10b6f54
- [x] 2.6 Inspect the ordered list and confirm category headers improve navigation while removing all category rows would still leave a coherent flat question list. — 10b6f54

### Phase 3: Prove and Document the Contract

#### Automated

- [x] 3.1 `.\node_modules\.bin\supabase.CMD db reset` succeeds from a clean local database.
- [x] 3.2 `.\node_modules\.bin\supabase.CMD test db` passes the ownership and visibility test suite.
- [x] 3.3 `pnpm.cmd run lint` passes.
- [x] 3.4 `pnpm.cmd run build` passes.

#### Manual

- [x] 3.5 Review the negative RLS cases and confirm the suite proves anonymous denial and cross-buyer isolation rather than only successful owner operations.
- [x] 3.6 Follow the README database setup and test steps from a clean local state and confirm they are sufficient and unambiguous.
