# Buyer Account Question Base - Plan Brief

> Full plan: `context/changes/buyer-account-question-base/plan.md`

## What & Why

Deliver the first buyer-visible question base. An authenticated buyer's personal copy is created atomically when they first open the dashboard, displayed as a flat ordered document, and preserved on repeat visits. A confirmed reset replaces the entire personal list with the currently active templates.

## Starting Point

F-01 already provides 88 ordered Polish template rows, an owner-isolated `buyer_questions` table, and pgTAP ownership tests. The protected dashboard is still a placeholder, and the database has no atomic initialization or reset operation.

## Desired End State

Any authenticated buyer can open `/dashboard` and immediately review their complete personal question list. Category rows remain in the flat sequence but look like headings. Repeat visits preserve the copy; explicit reset deletes every current row and recreates the active template document.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Provisioning moment | First question-list visit | Avoids creating unused copies and replaces the earlier account-creation requirement. |
| Existing accounts | Initialize lazily when uninitialized | Gives every buyer a consistent first-visit experience without deployment backfill. |
| Repeat visits | Never synchronize automatically | Preserves buyer ownership and future personal edits. |
| Visible outcome | Full list on dashboard | Proves the complete S-01 outcome rather than only backend state. |
| Sign-in redirect | Preserve redirect to `/` | Keeps current auth behavior unchanged. |
| List structure | Flat ordered rows with bold category headings | Matches the positional F-01 document contract. |
| Initialization failure | Atomic failure with retryable UI state | Prevents partial copies from appearing successful. |
| Reset | Confirmed full replacement | Provides a clear true reset at the accepted cost of deleting personal rows. |

## Scope

**In scope:**

- Update product documents from account-creation copying to first-visit initialization.
- Atomic authenticated database operations for ensure and destructive reset.
- Server question service, shared DTO, dashboard list, and reset endpoint.
- Flat ordered rendering with visually distinct category rows.
- pgTAP lifecycle tests and manual browser verification.

**Out of scope:**

- Signup/sign-in provisioning, automatic template synchronization, and deployment backfill.
- Question editing, personal notes, offers, extraction, answers, or a dedicated questions route.
- Preserving personal rows during reset or adding an application test runner.

## Architecture / Approach

Authenticated security-definer RPC functions derive ownership from `auth.uid()` and serialize each buyer's initialization/reset transaction. The server-rendered dashboard calls a question service to ensure then read the owner-isolated ordered rows. A static Astro component renders the document; a small Solid confirmation form posts destructive reset to a protected zod-validated endpoint.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contract and lifecycle | Updated requirements, atomic RPC functions, and pgTAP tests | Security-definer or concurrency mistakes could break isolation or idempotency. |
| 2. Question-base dashboard | Lazy initialization and complete flat ordered list | Failure handling must not present partial state as success. |
| 3. Destructive reset | Confirmed reset route, feedback, docs, and full flow verification | Reset intentionally deletes future personal rows. |

**Prerequisites:** Completed F-01 migrations, local Supabase/Docker, and an authenticated test buyer.

**Estimated effort:** Approximately 3 implementation sessions across 3 phases, including manual database and browser gates.

## Open Risks & Assumptions

- Any existing buyer row marks the list initialized; ensure will not repair or synchronize it.
- Reset deletes every current buyer row, including future personal questions.
- Category membership remains positional and must be preserved by future editing features.
- Hosted database migration remains separately approved from Worker deployment.
- UI behavior has manual coverage only because the repository has no application test runner.

## Success Criteria Summary

- First dashboard visit creates and displays one complete personal copy; repeat visits do not mutate it.
- Category and question rows render once in deterministic order with categories visually distinct.
- Confirmed reset atomically replaces the entire buyer list while preserving cross-buyer isolation.
- Database tests, lint, build, and documented manual browser checks pass.
