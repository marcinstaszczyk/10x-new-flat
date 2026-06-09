# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (1-5); cookbook patterns at the bottom (6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see 8).
>
> Last updated: 2026-06-09

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost x signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* - drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src`, `scripts`,
`supabase/migrations`. The last 30 days had 22 scoped commits; highest
churn was `src/lib/services` (16), `src/components/auth` (12),
`src/pages/api` (8), and `src/components/offers` (8).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact x likelihood. The Source column cites evidence, not code
anchors.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence - not anchor) |
|---|---|---|---|---|
| 1 | Buyer cannot complete the primary prepare-viewing flow after pasting a long offer. | High | High | interview Q1/Q4; PRD US-01 and FR-005..FR-008; roadmap S-03; hot-spot dir `src/lib/services` |
| 2 | Question-base initialization or reset duplicates or corrupts the buyer's question list. | High | Medium | interview Q4; PRD FR-002; archived F-01/S-01 slices |
| 3 | Deleting an offer removes another buyer's data. | High | Medium | PRD access control and delete requirement; roadmap S-02/S-03; archived S-02/S-03 slices |
| 4 | Extraction output looks complete but loses answered, unanswered, doubtful, or unmapped distinctions. | High | Medium | PRD guardrails and business logic; archived F-02/S-03 slices; hot-spot dir `src/lib/services` |
| 5 | Duplicate saved offers are created by repeated clicks during a frozen or slow submit. | Medium | High | interview Q2; PRD FR-003/FR-004; roadmap S-02; hot-spot dir `src/components/offers` |
| 6 | Buyer-owned private data leaks or cross-buyer mutations slip past app changes. | High | Low | PRD access control and privacy NFR; archived ownership slices; hot-spot dir `src/pages/api` |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | A saved long offer can be prepared and reviewed without losing the pasted context; live provider checks are on-demand before release only. | That a passing schema check means the user flow works. | Entry point, persisted state, provider boundary, timeout/error behavior. | integration + one critical e2e/manual smoke | Live LLM on every change; happy-path-only UI check. |
| #2 | First visit and reset leave exactly one coherent personal question list for the buyer. | That existing DB contracts cover the server-rendered flow. | Initialization trigger, reset lifecycle, ordering guarantee, fixture source. | database contract + integration | Duplicating production copy logic inside tests. |
| #3 | Deleting one buyer's offer cannot remove another buyer's offer or extraction result. | That authentication alone proves ownership. | Delete boundary, ownership check, cascade behavior. | database contract + API integration | Testing only the successful owner delete. |
| #4 | Missing, doubtful, known, and unmapped offer facts land in the correct user-visible buckets. | That provider output already carries the final app truth. | Contract, local completion rules, persisted payload, review rendering. | contract + integration | Mirroring current bucket transformation as the oracle. |
| #5 | Slow or repeated submit cannot create duplicate identical saved offers. | That disabling a button is enough protection. | Form submit behavior, API validation, persistence contract. | integration + focused browser/manual check | Testing only the first click. |
| #6 | A buyer cannot read or mutate another buyer's offers, questions, notes, or extraction results through app paths. | That RLS tests cover every app route. | Auth boundary, protected routes, API routes, database policies. | database contract + route integration | Over-mocking auth or bypassing cookies/session state. |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Critical prepare-viewing flow | Prove the primary long-offer preparation path still works without live LLM on every change. | #1, #4 | integration + e2e/manual smoke + on-demand contract check | change opened | testing-critical-prepare-viewing-flow |
| 2 | Ownership and destructive actions | Prove question lifecycle and offer deletion stay owner-scoped. | #2, #3, #6 | database contract + API/route integration | not started | - |
| 3 | Duplicate-submit protection | Prove slow or repeated saved-offer submission cannot create duplicate entries. | #5 | integration + focused browser/manual check | not started | - |
| 4 | Quality gates and cookbook | Make the shipped test commands discoverable and enforceable without adding live provider cost to CI. | cross-cutting | gates + cookbook | not started | - |

**Status vocabulary**: `not started`, `change opened`, `researched`,
`planned`, `implementing`, `complete`.

## 4. Stack

Test-base profile: sparse. The repo has no app/UI test runner configured,
but it already has five Supabase pgTAP database contract tests under
`supabase/tests/database/`.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| database contract | Supabase CLI / pgTAP | `supabase` ^2.23.4 | Existing owner, lifecycle, offer, and extraction-result contracts. |
| unit + integration | none yet | - | Add only where Phase 1/2 research proves cost x signal. |
| e2e/browser smoke | Browser plugin / local dev | checked: 2026-06-09 | Use selectively for the primary prepare-viewing path and duplicate-submit behavior. |
| live extraction contract | `pnpm run check:extraction-contract` | project script | On-demand before release; do not run on every change. |
| AI-native review | none planned | checked: 2026-06-09 | When NOT to use: deterministic contracts or browser checks already catch the risk. |

**Stack grounding tools (current session):**
- Docs: Context7 - Astro 6.3.1 docs checked for dev/build/check command guidance; checked: 2026-06-09.
- Search: none exposed in current session; checked: 2026-06-09.
- Runtime/browser: Browser plugin available for local verification; checked: 2026-06-09.
- Provider/platform: Supabase CLI present in project scripts; Cloudflare plugin available but not needed for this guide; checked: 2026-06-09.

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck/build | local + CI | required | syntax, type, Astro SSR, and Cloudflare build drift |
| database contracts | local; CI after Phase 4 if wired | required after 2 Phase 2 | RLS, ownership, lifecycle, cascade regressions |
| app integration | local; CI after Phase 4 if wired | required after 2 Phase 1 | primary flow and route/service regressions |
| critical browser/manual smoke | local before release | required after 2 Phase 1 | broken user-facing prepare-viewing and duplicate-submit paths |
| live LLM contract check | manual pre-release | optional, on-demand | provider/schema drift without per-change cost |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD - see 3 Phase N."

### 6.1 Adding a database contract test

TBD - see 3 Phase 2 for ownership, lifecycle, and destructive-action
contracts.

### 6.2 Adding an app integration test

TBD - see 3 Phase 1 for prepare-viewing and extraction-bucket behavior.

### 6.3 Adding a critical browser/manual smoke

TBD - see 3 Phase 1 for long-offer preparation and 3 Phase 3 for
duplicate-submit behavior.

### 6.4 Adding an on-demand live extraction check

TBD - see 3 Phase 4. This stays pre-release/on-demand, not per-change CI.

### 6.5 Per-rollout-phase notes

TBD - filled as rollout phases ship.

## 7. What We Deliberately Don't Test

- **Mobile polish** - MVP is desktop-first. Re-evaluate when mobile becomes a target.
- **Offer comparison** - explicitly out of MVP. Re-evaluate when comparison enters the roadmap.
- **Admin question-base UI** - out of MVP. Re-evaluate when base-question management is no longer fixed.
- **Visual-perfect styling** - current risk is flow correctness, not pixel precision. Re-evaluate before public design polish.
- **Live LLM on every change** - too costly and noisy for this stage. Use on-demand before release.

## 8. Freshness Ledger

- Strategy (1-5) last reviewed: 2026-06-09
- Stack versions last verified: 2026-06-09
- AI-native tool references last verified: 2026-06-09

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes,
- 7 negative-space no longer matches what the team believes.
