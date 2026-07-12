---
date: 2026-07-12T18:33:34+02:00
researcher: Codex
git_commit: 61e16054699c1b11fed87899b89abb4102a971bf
branch: main
repository: 10x-new-flat
topic: "CI/CD code review verification and improvement based on requirements.md"
tags: [research, codebase, github-actions, code-review, codex]
status: complete
last_updated: 2026-07-12
last_updated_by: Codex
last_updated_note: "Aligned research with the corrected main-branch requirement"
---

# Research: CI/CD Code Review Verification and Improvement

**Date**: 2026-07-12T18:33:34+02:00  
**Researcher**: Codex  
**Git Commit**: 61e16054699c1b11fed87899b89abb4102a971bf  
**Branch**: main  
**Repository**: 10x-new-flat

## Research Question

Verify the existing CI/CD code-review implementation and determine how to improve it to satisfy [`requirements.md`](requirements.md): review each new pull request to the target branch, extract review execution into a composite action, supply PR title/description/diff, publish a summary comment and exclusive result label, and support retry via `ai-cr:review`.

## Summary

The repository already has a security-conscious AI review workflow and a reusable reviewer package, but it does not yet satisfy the requested contract. The workflow checks out trusted base-branch code, treats the PR head only as diff data, isolates provider credentials, produces structured output, updates a single marker comment, and gates on the model verdict. Those are strong foundations.

The main gaps are:

1. **Ordinary CI branch drift:** the corrected requirement and AI workflow target `main`, but ordinary CI and README still say `master`. PRs to `main` currently receive AI review but not ordinary lint/build CI.
2. **Missing inputs:** only the diff reaches the model. PR title and description are absent.
3. **Missing side effects and retry:** result labels and `ai-cr:review` handling do not exist.
4. **Fail-open execution path:** if review execution errors or is skipped, the dependent gate is skipped instead of explicitly failing.
5. **Weak score enforcement:** structured parsing accepts any number, including fractions and values outside 1–10; the model alone chooses the verdict.
6. **Unbounded/untrusted context:** the diff uses 80 context lines without a size limit, empty stdin falls back to a bundled sample, and the prompt has no explicit untrusted-data boundary.
7. **No deterministic verification:** the reviewer has no unit tests, and the current CI runs neither the existing app tests nor reviewer-specific checks.

The appropriate boundary is a local composite action for deterministic review execution and output export, while the workflow retains event filtering, trusted checkout/diff creation, secrets, permissions, PR publishing, and the final required-check gate.

## Detailed Findings

### Requirements and Branch Alignment

- The corrected requirements target new PRs to `main`, request a composite action, and identify title, optional description, and diff as inputs ([`requirements.md:3`](requirements.md#L3), [`requirements.md:4`](requirements.md#L4), [`requirements.md:8`](requirements.md#L8)).
- The AI review workflow deliberately targets `main` and defaults manual comparison to `main` ([`.github/workflows/review.yml:3`](../../../.github/workflows/review.yml#L3)). Commit `ad76f7c` explicitly migrated it from `master` to `main`.
- The checked-out branch and GitHub default branch are also `main`; `origin/main` exists. The requirement and live repository now agree on the authoritative target.
- Ordinary CI still targets only `master` ([`.github/workflows/ci.yml:3`](../../../.github/workflows/ci.yml#L3)), and README repeats that stale contract ([`README.md:249`](../../../README.md#L249)). Consequently, current PRs to `main` can receive AI review without lint/build CI.
- No deployment workflow exists. Deployment remains a manual Wrangler operation ([`README.md:231`](../../../README.md#L231)); this change is CI/code-review improvement, not a complete CD implementation.

**Implication:** retain `main` in `review.yml`, migrate `ci.yml` and README from `master` to `main`, and ensure branch-protection required checks target `main`.

### Current AI Review Workflow

- The workflow runs on PR open, synchronize, and reopen, plus manual dispatch ([`.github/workflows/review.yml:3`](../../../.github/workflows/review.yml#L3)). Per-PR concurrency cancels obsolete runs ([`.github/workflows/review.yml:14`](../../../.github/workflows/review.yml#L14)).
- It skips fork PRs by requiring the PR head repository to equal the base repository ([`.github/workflows/review.yml:19`](../../../.github/workflows/review.yml#L19)). This protects secrets but conflicts with the literal meaning of “every” PR.
- The review job checks out the trusted base SHA, fetches full history, and disables persisted credentials ([`.github/workflows/review.yml:29`](../../../.github/workflows/review.yml#L29)). It fetches the head SHA only to create a three-dot diff and never executes head code ([`.github/workflows/review.yml:46`](../../../.github/workflows/review.yml#L46)). Preserve this trust boundary.
- The generated diff uses `--unified=80` and has no size or file limit ([`.github/workflows/review.yml:61`](../../../.github/workflows/review.yml#L61)). Large PRs can cause avoidable token cost or model context failure.
- OpenAI/OpenRouter branching and package invocation are duplicated inline ([`.github/workflows/review.yml:63`](../../../.github/workflows/review.yml#L63)). These steps are the clearest extraction candidate.
- Export currently exposes only `verdict` and `summary` ([`.github/workflows/review.yml:25`](../../../.github/workflows/review.yml#L25)). The fixed multiline delimiter `CODEX_REVIEW` can be broken if model-controlled summary content contains that exact delimiter line ([`.github/workflows/review.yml:79`](../../../.github/workflows/review.yml#L79)).

### Code-Review Package Contract

- The standalone command invokes Node directly on `review.ts` ([`packages/code-review/package.json:5`](../../../packages/code-review/package.json#L5)); Node is fixed at 24.15.0 in [`.nvmrc:1`](../../../.nvmrc#L1).
- `readDiff()` reads stdin, trims it, and normalizes a trailing newline ([`packages/code-review/review.ts:35`](../../../packages/code-review/review.ts#L35)). If stdin is empty, it silently loads `data/sample-1.md` ([`packages/code-review/review.ts:23`](../../../packages/code-review/review.ts#L23)). An empty CI diff can therefore review sample content instead of failing clearly.
- The public review API accepts only a `diff: string`, and the prompt contains only the rubric plus diff ([`packages/code-review/review.ts:127`](../../../packages/code-review/review.ts#L127)). Title and description are not modeled.
- Six criteria already exist: implementation correctness, idiomaticity, complexity, test-risk coverage, documentation, and security/safety ([`packages/code-review/common/review-schema.ts:30`](../../../packages/code-review/common/review-schema.ts#L30)). The parked business-alignment and architectural-fit criteria are correctly absent.
- Each criterion has a score and rationale, but score validation is only `z.number()` ([`packages/code-review/common/review-schema.ts:24`](../../../packages/code-review/common/review-schema.ts#L24)). The file documents a provider-schema compatibility reason, then relies on prompt instructions for integer bounds ([`packages/code-review/common/review-schema.ts:15`](../../../packages/code-review/common/review-schema.ts#L15)). Runtime post-validation is still needed after structured output is returned.
- The model emits an authoritative `pass`/`fail`; no deterministic score threshold exists ([`packages/code-review/common/review-schema.ts:65`](../../../packages/code-review/common/review-schema.ts#L65)). This may be acceptable, but it is a policy decision that should be explicit and tested.
- Parsing supports both canonical nested and legacy flat output shapes ([`packages/code-review/review.ts:9`](../../../packages/code-review/review.ts#L9), [`packages/code-review/review.ts:50`](../../../packages/code-review/review.ts#L50)). Provider, JSON, SDK, rate-limit, and network errors are uncaught and correctly make the process non-zero, but no stable error result or retry exists.
- The Codex thread is read-only, never requests approval, disables web search, and skips repository validation ([`packages/code-review/review.ts:127`](../../../packages/code-review/review.ts#L127)). API keys and `GITHUB_TOKEN` are excluded from the child environment ([`packages/code-review/review.ts:66`](../../../packages/code-review/review.ts#L66), [`packages/code-review/review.ts:95`](../../../packages/code-review/review.ts#L95)).

### PR Comment, Labels, Retry, and Gate

- The summary comment already has useful idempotency: it searches for a hidden marker and updates or creates one bot comment ([`.github/workflows/review.yml:93`](../../../.github/workflows/review.yml#L93)). Matching any bot is broader than needed; matching `github-actions[bot]` would reduce collision risk.
- No label mutation exists. The only `ai-cr:*` references are in requirements. Result publication needs `issues: write` because PR labels use the Issues API; keep this permission isolated to the publishing job.
- No `labeled` PR activity trigger exists ([`.github/workflows/review.yml:4`](../../../.github/workflows/review.yml#L4)). Retry should accept only `github.event.action == 'labeled' && github.event.label.name == 'ai-cr:review'` in addition to normal PR actions.
- Consume/remove `ai-cr:review` after a retry so it can be added again. Because `unlabeled` is not subscribed, removal does not create a loop.
- Reconcile outcome labels idempotently: ensure labels exist with the intended colors, remove the retry and opposite outcome labels, then add exactly one of `ai-cr:passed` or `ai-cr:failed`.
- The comment job runs only after a successful review ([`.github/workflows/review.yml:85`](../../../.github/workflows/review.yml#L85)). Provider/schema failures therefore publish neither a diagnostic comment nor a defined failure label.
- The gate depends on the review job and has no `always()` condition ([`.github/workflows/review.yml:126`](../../../.github/workflows/review.yml#L126)). If review errors or skips, the gate also skips. A final always-running gate should fail unless review execution succeeded and verdict equals `pass`.
- Define whether `ai-cr:failed` means only an AI fail verdict or also infrastructure/provider failure. A practical policy is to reserve the same red label for any non-passing completed attempt while making the comment distinguish review findings from execution failure.

### GitHub Security and Fork PRs

- Current same-repository filtering is a deliberate safe default because `pull_request` workflows from forks receive restricted tokens and no repository secrets. Official GitHub documentation confirms this behavior and recommends `pull_request_target` only for trusted-base operations such as labeling/commenting, not for building or executing PR code: [events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
- If fork support is required, use a trusted-base `pull_request_target` or two-stage design and continue treating PR content only as untrusted data. Never checkout or run head code in a job holding provider secrets or a write token.
- PR title, body, and diff are prompt-injection inputs. Pass them through environment variables/files rather than interpolating them into shell code, add explicit prompt delimiters and untrusted-data instructions, and retain the read-only/no-web/no-approval Codex configuration.
- External actions currently use mutable major tags such as `actions/checkout@v4` and `actions/github-script@v7` ([`.github/workflows/review.yml:29`](../../../.github/workflows/review.yml#L29), [`.github/workflows/review.yml:93`](../../../.github/workflows/review.yml#L93)). Pinning full commit SHAs is a separate supply-chain hardening improvement worth considering.

### Composite Action Boundary

GitHub composite actions support declared inputs/outputs and step sequences, but permissions and secrets remain the caller workflow's responsibility: [composite-action documentation](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action).

Recommended split:

**`.github/actions/code-review/action.yml` owns:**

- Node setup assumption validation or documented Node prerequisite.
- Reviewer dependency installation.
- Bounded input assembly from title, description, and a diff file path.
- Provider/model invocation without duplicated OpenAI/OpenRouter workflow steps.
- JSON parsing plus deterministic post-validation.
- Safe export of verdict, summary, and preferably the full result JSON/result path.

**`.github/workflows/review.yml` owns:**

- PR/manual event filtering and retry predicate.
- Job permissions and provider secret selection.
- Trusted base checkout and head-as-data diff acquisition.
- Composite action invocation.
- Comment upsert and exclusive label reconciliation.
- Retry-label consumption.
- Always-running fail-closed required-check gate.

Use a diff file path rather than a huge multiline action input. Pass PR title/body through `env` or files and apply explicit length limits. The description's marginal token cost is normally small relative to the current 80-context diff, so include a bounded description; it supplies intent that improves implementation-correctness assessment.

### Verification Strategy

- The reviewer package has no test script or test files ([`packages/code-review/package.json:5`](../../../packages/code-review/package.json#L5)). Root Vitest includes only `src/**/*.test.ts`, so it cannot cover this package ([`vitest.config.ts:16`](../../../vitest.config.ts#L16)).
- Ordinary CI runs install, Astro sync, lint, and build only ([`.github/workflows/ci.yml:18`](../../../.github/workflows/ci.yml#L18)); root `test:app`, Playwright, and database tests are omitted.
- Add deterministic tests for:
  - title/body/diff prompt assembly, truncation, delimiters, empty diff, and oversized diff;
  - nested and legacy flat parsing;
  - integer 1–10 post-validation and non-empty rationales/summary;
  - verdict-to-exclusive-label mapping;
  - marker comment create/update behavior;
  - normal versus retry event predicate;
  - safe multiline output export.
- Statically validate workflow and action YAML with `actionlint` or an equivalent pinned tool.
- Perform a real GitHub smoke matrix: same-repo PR open; synchronize/concurrency; pass; fail; provider error; retry label twice; comment update; opposite-label removal; manual dispatch; and fork/Dependabot behavior according to the chosen policy.
- The existing project precedent keeps live provider calls out of deterministic test commands ([`context/archive/2026-06-09-testing-critical-prepare-viewing-flow/plan.md:36`](../../archive/2026-06-09-testing-critical-prepare-viewing-flow/plan.md#L36)). Keep SDK/provider tests mocked and reserve a live review for an explicit smoke test.

## Code References

- `.github/workflows/review.yml:3-16` - current triggers and concurrency.
- `.github/workflows/review.yml:19-83` - review trust boundary, diff generation, provider invocation, and output export.
- `.github/workflows/review.yml:85-135` - marker comment and current gate.
- `.github/workflows/ci.yml:3-24` - stale `master` target and current lint/build-only CI.
- `packages/code-review/review.ts:23-48` - stdin/sample fallback behavior.
- `packages/code-review/review.ts:50-63` - nested/flat response parsing.
- `packages/code-review/review.ts:66-141` - provider configuration, credential isolation, and Codex call.
- `packages/code-review/common/review-schema.ts:15-26` - unenforced score bounds.
- `packages/code-review/common/review-schema.ts:30-101` - criteria, verdict/summary contract, prompt, and JSON schema.
- `packages/code-review/package.json:5-16` - standalone command and dependencies, with no verification scripts.
- `vitest.config.ts:16-20` - root test scope excludes the reviewer package.
- `README.md:231-251` - manual deployment and stale CI branch documentation.

GitHub permalinks were not substituted because the researched commit is nine commits ahead of `origin/main` and is not available remotely yet. The repository is `marcinstaszczyk/10x-new-flat`, whose remote default branch is `main`.

## Architecture Insights

- **Separate deterministic mechanism from repository policy.** The composite action should execute and validate a review. The workflow should decide when it runs, what privileges it gets, and what PR state it mutates.
- **Preserve the current data-only treatment of PR head content.** This is the most important security property in the existing implementation.
- **Make publication idempotent and gating fail-closed.** Re-running should update one comment and one mutually exclusive label; any non-successful execution should make the required check fail explicitly.
- **Treat structured model output as untrusted input.** JSON schema improves shape reliability but does not replace deterministic post-validation or output-channel escaping.
- **Keep provider calls outside deterministic CI tests.** Mock at the package boundary; use an explicit live smoke workflow when needed.
- **Enforce the resolved `main` contract consistently.** CI, AI review, documentation, GitHub default settings, and branch protection must all target `main`.

## Historical Context (from prior changes)

- Commit `91fa1a8` introduced the GitHub AI review workflow.
- Commit `ad76f7c` deliberately changed only the AI review workflow from `master` to `main`, leaving ordinary CI and README behind.
- Commit `1d579dd` added local/OpenAI/OpenRouter provider support.
- Commit `61e1605` added compatibility with flat model output after nested-output reliability issues.
- [`context/archive/2026-06-09-testing-critical-prepare-viewing-flow/plan.md:36`](../../archive/2026-06-09-testing-critical-prepare-viewing-flow/plan.md#L36) deferred CI quality-gate wiring and established that live AI provider calls do not belong in deterministic test commands.
- [`context/archive/2026-06-09-testing-critical-prepare-viewing-flow/plan.md:84`](../../archive/2026-06-09-testing-critical-prepare-viewing-flow/plan.md#L84) records the dual-lockfile constraint: local work uses pnpm while CI uses npm.
- [`context/foundation/roadmap.md:51`](../../foundation/roadmap.md#L51) characterizes deployment/infra as partial because checks exist but deployment remains manual.

## Related Research

- [`context/archive/2026-06-09-testing-critical-prepare-viewing-flow/research.md`](../../archive/2026-06-09-testing-critical-prepare-viewing-flow/research.md) - prior deterministic-testing research relevant to CI verification boundaries.

No prior research artifact specifically covers the AI code-review workflow.

## Open Questions

1. Must “every PR” include forks and Dependabot, or is same-repository-only an accepted security constraint?
2. Does `ai-cr:failed` represent an AI fail verdict only, or any review execution that does not produce a pass?
3. Should the verdict remain model-authoritative, or should deterministic score thresholds override it?
4. What maximum PR description and diff sizes should be reviewed, and what behavior should apply when limits are exceeded?
5. Should this change also add `test:app` to ordinary CI, or only reviewer-specific verification?

## Follow-up Research 2026-07-12T19:05:16+02:00

The requirements were corrected to target pull requests to `main`. This resolves the previously identified requirements-versus-repository ambiguity: `requirements.md`, the AI review workflow, the checked-out branch, and the GitHub default branch now agree on `main`.

The remaining branch-related work is implementation drift, not an open product decision: update ordinary CI and README from `master` to `main`, while retaining the AI review workflow's existing `main` trigger.
