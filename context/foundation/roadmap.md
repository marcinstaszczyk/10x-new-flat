---
project: 10xNewFlat
version: 1
status: draft
created: 2026-06-02
updated: 2026-06-02
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: 10xNewFlat

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Preparing questions and topics for a flat viewing takes time, and buyers can miss important topics before or during a viewing. The product combines a question knowledge base with extracted offer information, then avoids asking about facts already present unless the extracted answer is uncertain or suspicious.

## North star

**S-03: Buyer can review an extracted viewing-preparation result** - this is the north star, meaning the smallest end-to-end slice whose successful delivery proves the core product hypothesis. It is placed as early as its prerequisites allow because the product only earns its value when pasted offer content becomes a useful, trustworthy question list.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | buyer-data-ownership-contract | (foundation) Minimal buyer-owned persistence rules and a fixed base-question source are in place. | - | FR-002, PRD Access Control, PRD Non-Functional Requirements | ready |
| F-02 | extraction-contract-check | (foundation) A minimal extraction contract and verification path are agreed. | - | FR-005, PRD Success Criteria, PRD Non-Functional Requirements | ready |
| S-01 | buyer-account-question-base | Buyer can sign in and receive a personal copy of the fixed base-question list. | F-01 | US-01, FR-001, FR-002 | proposed |
| S-02 | saved-pasted-offer | Buyer can create, delete, and revisit a private flat offer containing pasted offer-page content. | S-01 | US-01, FR-003, FR-004, PRD Non-Functional Requirements | proposed |
| S-03 | extracted-viewing-preparation | Buyer can review extracted answers, unanswered questions, doubtful facts, and unmapped offer information. | F-02, S-02 | US-01, FR-005, FR-006, FR-007, FR-008, PRD Success Criteria, PRD Non-Functional Requirements | proposed |
| S-04 | personal-questions-notes | Buyer can add, edit, and remove personal questions and notes. | S-01 | FR-009 | proposed |

## Streams

Navigation aid - groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Buyer-owned preparation workspace | `F-01` -> `S-01` -> `S-02` / `S-04` | Establishes the shortest account-to-saved-offer path; `S-04` branches after account setup. |
| B | Trustworthy extraction | `F-02` -> `S-03` | Joins Stream A after `S-02` and delivers the first proof of product value. |

## Baseline

What's already in place in the codebase as of `2026-06-02` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present - server-rendered UI, interactive islands, utility styling, and shared UI components are configured (`astro.config.mjs:11`, `src/components/ui/button.tsx:6`).
- **Backend / API:** present - server rendering, request handlers, and request middleware exist (`src/pages/api/auth/signin.ts:4`, `src/middleware.ts:6`).
- **Data:** partial - the server client exists for authentication, but product tables, migrations, and seed data are absent (`src/lib/supabase.ts:1`, `supabase/config.toml:53`).
- **Auth:** present - authentication operations and request-time user resolution exist (`src/middleware.ts:9`).
- **Deploy / infra:** partial - runtime configuration and CI checks exist, while production deployment remains manual (`wrangler.jsonc:4`, `.github/workflows/ci.yml:18`).
- **Observability:** partial - runtime logs are enabled; application metrics and error tracking are absent (`wrangler.jsonc:14`).

## Foundations

### F-01: Minimal buyer-data ownership contract

- **Outcome:** (foundation) Minimal buyer-owned persistence rules and a fixed base-question source are in place.
- **Change ID:** buyer-data-ownership-contract
- **PRD refs:** FR-002, PRD Access Control, PRD Non-Functional Requirements
- **Unlocks:** S-01, S-02, S-04
- **Prerequisites:** -
- **Parallel with:** F-02
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Buyer content must be isolated from the first stored record; postponing ownership rules would make later vertical work unsafe to verify.
- **Status:** ready

### F-02: Minimal extraction contract check

- **Outcome:** (foundation) A minimal extraction contract and verification path are agreed for latency, doubtful values, and unmapped information.
- **Change ID:** extraction-contract-check
- **PRD refs:** FR-005, PRD Success Criteria, PRD Non-Functional Requirements
- **Unlocks:** S-03
- **Prerequisites:** -
- **Parallel with:** F-01, S-01, S-02, S-04
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Extraction is the core product risk; a narrow contract check prevents the first complete flow from being planned around an unverified assumption.
- **Status:** ready

## Slices

### S-01: Buyer account receives its question base

- **Outcome:** Buyer can sign in and receive a personal copy of the fixed base-question list.
- **Change ID:** buyer-account-question-base
- **PRD refs:** US-01, FR-001, FR-002
- **Prerequisites:** F-01
- **Parallel with:** F-02
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Authentication already exists, so this slice stays focused on the account-creation outcome instead of rebuilding login.
- **Status:** proposed

### S-02: Buyer saves pasted offer content

- **Outcome:** Buyer can create, delete, and revisit a private flat offer containing pasted offer-page content.
- **Change ID:** saved-pasted-offer
- **PRD refs:** US-01, FR-003, FR-004, PRD Non-Functional Requirements
- **Prerequisites:** S-01
- **Parallel with:** F-02, S-04
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Persisted offer content is sensitive, so create and delete behavior must land together with ownership checks.
- **Status:** proposed

### S-03: Buyer reviews an extracted viewing-preparation result

- **Outcome:** Buyer can review extracted answers, unanswered questions, doubtful facts, and unmapped offer information.
- **Change ID:** extracted-viewing-preparation
- **PRD refs:** US-01, FR-005, FR-006, FR-007, FR-008, PRD Success Criteria, PRD Non-Functional Requirements
- **Prerequisites:** F-02, S-02
- **Parallel with:** S-04
- **Blockers:** -
- **Unknowns:**
  - Which user-facing wording makes doubtful and unmapped information easiest to review? - Owner: user. Block: no.
- **Risk:** The result must remain useful without inventing facts; this slice proves the product before secondary editing features are prioritized.
- **Status:** proposed

### S-04: Buyer manages personal questions and notes

- **Outcome:** Buyer can add, edit, and remove personal questions and notes.
- **Change ID:** personal-questions-notes
- **PRD refs:** FR-009
- **Prerequisites:** S-01
- **Parallel with:** F-02, S-02, S-03
- **Blockers:** -
- **Unknowns:**
  - Should notes attach to the buyer question base, a specific offer, or both? - Owner: user. Block: yes.
- **Risk:** Notes can expand into a broader editing product, so the ownership decision must be resolved before planning.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | buyer-data-ownership-contract | Establish minimal buyer-data ownership contract | yes | Run `/10x-plan buyer-data-ownership-contract` |
| F-02 | extraction-contract-check | Verify minimal extraction contract | yes | Run `/10x-plan extraction-contract-check` |
| S-01 | buyer-account-question-base | Copy fixed questions into a buyer account | no | Requires F-01 |
| S-02 | saved-pasted-offer | Save private pasted offer content | no | Requires S-01 |
| S-03 | extracted-viewing-preparation | Produce a reviewable viewing-preparation result | no | Requires F-02 and S-02 |
| S-04 | personal-questions-notes | Manage personal questions and notes | no | Resolve note ownership and complete S-01 |

## Open Roadmap Questions

1. **Should notes attach to the buyer question base, a specific offer, or both?** - Owner: user. Block: S-04.

## Parked

- **Mobile app** - Why parked: PRD Non-Goals excludes a mobile app from MVP.
- **Offer comparison** - Why parked: PRD Non-Goals keeps the first version focused on preparing one viewing at a time.
- **Automatic answer scoring or evaluation** - Why parked: PRD Non-Goals leaves interpretation to the buyer.
- **Closed yes/no questionnaire conversion** - Why parked: PRD Non-Goals keeps questions suitable for a viewing conversation.
- **Link-based offer import** - Why parked: PRD Non-Goals requires manual paste for MVP.
- **Admin UI for question-base management** - Why parked: PRD Non-Goals keeps the initial base list fixed.
- **Application metrics and error tracking beyond runtime logs** - Why parked: current runtime logs are enough for the strict MVP path; expand after the core extraction flow is verified.
- **Automated production deployment** - Why parked: manual deployment is documented and sufficient for the first release.

## Done
