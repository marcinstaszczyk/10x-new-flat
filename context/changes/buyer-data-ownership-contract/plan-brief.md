# Buyer Data Ownership Contract — Plan Brief

> Full plan: `context/changes/buyer-data-ownership-contract/plan.md`

## What & Why

Establish the minimal persistence and authorization contract required before buyer questions, offers, and notes can be implemented safely. The change adds a fixed Polish base-question source and a buyer-owned ordered question list whose privacy is enforced directly by Supabase RLS.

## Starting Point

The repository currently uses Supabase Auth only; there are no product tables, migrations, seed data, or database tests. The application uses a session-aware Supabase client with the anon key, so RLS must enforce buyer isolation from the first stored product row.

## Desired End State

Authenticated buyers can read the active fixed question templates and fully manage only their own question rows. The repository ships a comprehensive Polish flat-viewing checklist and executable pgTAP tests proving anonymous denial, cross-buyer isolation, and account-deletion cleanup.

## Key Decisions Made

| Decision             | Choice                                           | Why                                                                  |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Scope                | `question_templates` and `buyer_questions` only  | Keeps F-01 minimal while proving the first buyer-owned contract.     |
| Template source      | Versioned production migration                   | All environments receive the same canonical product content.         |
| Buyer question model | One buyer-owned table                            | Copied and personal rows share one stable future-facing contract.    |
| List structure       | `question_type = category \| open_question` rows | Supports grouped and completely flat lists without category tables.  |
| Category deletion    | Delete header only                               | Buyer questions are never deleted implicitly.                        |
| Template access      | Authenticated users read active rows only        | Supports future copying while protecting inactive and draft content. |
| Buyer access         | Owner-only SELECT, INSERT, UPDATE, DELETE        | RLS is the durable privacy boundary.                                 |
| Account deletion     | Cascade buyer questions                          | Prevents orphaned private data.                                      |
| Initial content      | Full Polish question list authored in F-01       | S-01 receives a useful base rather than a fixture.                   |
| Verification         | pgTAP RLS and behavior tests                     | Makes the security contract executable and regression-resistant.     |

## Scope

**In scope:**

- Two-table schema, ordering, provenance, constraints, indexes, and RLS policies.
- Comprehensive Polish template content delivered through a migration.
- Category headers and open-question rows in one ordered document model.
- pgTAP tests and local database workflow documentation.

**Out of scope:**

- Copy-on-signup behavior, question UI/API, offers, notes, and extraction.
- Separate category entities, closed questions, scoring, and admin UI.
- Updating existing buyer copies when templates change.

## Architecture / Approach

`question_templates` is a global read-only ordered document. `buyer_questions` is an independent buyer-owned ordered document with optional template provenance. Both use `question_type` rows, so category headers are display structure rather than relational parents. Supabase RLS permits active template reads and owner-only buyer CRUD.

## Phases at a Glance

| Phase                                      | What it delivers                                     | Key risk                                                  |
| ------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| 1. Establish schema and ownership rules    | Stable tables, constraints, indexes, grants, and RLS | A policy gap could expose buyer data.                     |
| 2. Ship the full Polish base-question list | Canonical, useful production content                 | “Full” requires careful content review and deduplication. |
| 3. Prove and document the contract         | pgTAP regression suite and repeatable local workflow | Tests must prove denied behavior, not only happy paths.   |

**Prerequisites:** Local Supabase stack and Docker for migration and pgTAP verification.

**Estimated effort:** Approximately 3 implementation sessions across 3 phases, including a human content-review gate.

## Open Risks & Assumptions

- Category membership is positional; future UI and services must preserve ordering semantics.
- The initial full Polish list is authored during implementation and requires human product-content approval.
- The initial type set is only `category` and `open_question`; closed questions require a future migration.
- Supabase migrations require a separate human-approved hosted deployment and cannot be rolled back by Cloudflare.

## Success Criteria (Summary)

- A clean Supabase reset creates both tables and loads the comprehensive Polish template list.
- Authenticated buyers can manage only their own question rows; anonymous and cross-buyer access is denied.
- Database tests, repository lint, and production build pass, and the README accurately documents the workflow.
