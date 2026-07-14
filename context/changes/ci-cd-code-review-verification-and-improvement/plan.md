# AI Code Review CI/CD Verification and Improvement Plan

## Overview

Harden the existing Codex-based pull-request reviewer, extract its deterministic execution into a local composite action, and make the GitHub workflow publish reliable review state for same-repository pull requests to `main`. The finished workflow will review bounded PR context, update one summary comment, maintain one of three mutually exclusive outcome labels, support label-driven retries, and fail its required gate on review, execution, or publication failure.

The same change will align ordinary CI with `main` and enforce the existing deterministic application tests, new reviewer tests, workflow validation, lint, and build. Live model calls remain outside deterministic test commands.

## Current State Analysis

The repository already has a standalone reviewer package and an AI review workflow. The workflow safely checks out the trusted base SHA, fetches the PR head only as data, disables persisted checkout credentials, invokes Codex with a read-only/no-web/no-approval thread, exports a structured verdict, updates a marker comment, and gates on `pass`.

The current implementation is incomplete at its boundaries. The reviewer accepts only a diff, silently substitutes sample data for empty stdin, trusts prompt-only score bounds, and has no deterministic tests. The workflow duplicates provider execution, does not create result labels or consume a retry label, skips its gate when review execution fails, and uses an unsafe fixed output delimiter. Ordinary CI still targets `master` and omits deterministic app and reviewer tests.

### Key Discoveries

- The review workflow already preserves the critical trusted-base/head-as-data boundary in `.github/workflows/review.yml:29-61`.
- The reviewer accepts only `diff: string` and appends it directly to the prompt in `packages/code-review/review.ts:127-141`.
- Empty stdin falls back to bundled sample content in `packages/code-review/review.ts:23-48`.
- Integer 1-10 score bounds are not runtime-enforced in `packages/code-review/common/review-schema.ts:15-26`.
- Comment publication is marker-based but label publication and retry behavior are absent in `.github/workflows/review.yml:85-124`.
- The dependent gate can skip on review failure because it lacks an always-running normalization path in `.github/workflows/review.yml:126-135`.
- Root Vitest intentionally covers only `src/**/*.test.ts`; the standalone reviewer needs its own test harness (`vitest.config.ts:16-20`).
- The foundation test plan has already reserved rollout Phase 4 for deterministic quality-gate wiring (`context/foundation/test-plan.md:61-75`).

## Desired End State

- Every eligible same-repository PR opened, synchronized, or reopened against `main` receives an AI review; adding `ai-cr:review` requests another review.
- The reviewer receives the PR title, optional description, and complete bounded diff as explicitly delimited untrusted data.
- Descriptions above 10,000 characters, diffs above 200 KiB, and empty diffs fail closed with an execution error; no input is silently truncated or replaced with sample content.
- Model output is accepted only when every criterion score is an integer from 1 through 10 and all rationales and the summary are non-empty. The model remains authoritative for `pass` or `fail`.
- A local composite action owns dependency installation, reviewer invocation, validation, and safe outputs. The workflow owns events, permissions, checkout/diff creation, secrets, PR publication, and the final gate.
- After successful PR publication, exactly one terminal label is present: `ai-cr:passed`, `ai-cr:failed`, or `ai-cr:error`. One marker comment distinguishes review rejection from execution errors; publication failure itself is represented by the failing gate because the workflow cannot guarantee PR mutation when the write API fails.
- Review, execution, and publication errors make the final required check fail rather than skip.
- Ordinary CI targets `main` and runs deterministic application tests, reviewer tests, workflow validation, lint, and build without live LLM calls.

## Decisions

| Decision | Choice | Rationale | Source |
| --- | --- | --- | --- |
| PR source scope | Same-repository PRs only | Preserves the current secret-safe boundary; fork support would require a higher-risk trusted-base event design. | Plan |
| Outcome labels | Passed, failed, and error | Keeps model rejection distinct from provider, validation, context, or publication failure. | Plan |
| Verdict authority | Model verdict with strict validation | Requirements define scores but no deterministic weighting or threshold. | Plan |
| Description limit | 10,000 characters, fail closed | Bounds cost without reviewing partial intent. | Plan |
| Diff limit | 200 KiB, fail closed | Prevents partial reviews from passing and keeps cost predictable. | Plan |
| Retry lifecycle | Consume `ai-cr:review` after terminal reconciliation | Keeps retry visible while pending and permits repeated retries after completion. | Research |
| Test ownership | Package-local reviewer Vitest suite | Preserves the standalone npm package boundary and root app-test scope. | Research |
| Ordinary CI | App tests plus reviewer tests | Completes deferred quality-gate wiring without live provider cost. | Plan |

## What We're NOT Doing

- No review of fork-origin or Dependabot PRs that do not receive repository secrets.
- No `pull_request_target` or two-stage privileged fork workflow.
- No business-alignment or architectural-fit criteria.
- No deterministic numeric verdict threshold or score weighting.
- No diff truncation, chunking, or multi-review aggregation.
- No live OpenAI/OpenRouter/Codex call in deterministic tests, lint, or build.
- No Playwright, Supabase database-suite, deployment, or branch-protection automation.
- No broad refactor of the application test setup.

## Implementation Approach

First make the reviewer a deterministic, testable contract: explicit PR inputs, fail-closed limits, untrusted-data prompt boundaries, strict post-validation, and package-local tests. Next wrap that contract in a composite action that exposes safe outputs while leaving secrets and permissions in the caller. Then refactor the workflow around an explicit eligible-event predicate, terminal-state normalization, idempotent publication, retry consumption, and an always-running gate. Finally align ordinary CI and documentation, add static workflow checks, and verify the complete behavior through a real same-repository PR smoke matrix.

## Critical Implementation Details

The PR head must remain data-only. Local action code must be loaded from the checked-out base SHA; no job holding provider secrets or a write-capable token may checkout, import, build, or execute PR-head code.

The final gate is the authoritative required check. Review execution may use a captured/normalized error path so publication can still run, but the gate must succeed only when execution produced `pass` and terminal PR publication succeeded. Unrelated `labeled` events and unsupported fork PRs should skip the eligible workflow path rather than create a misleading failure.

## Phase 1: Harden and Test the Reviewer Contract

### Overview

Replace the diff-only/sample-fallback CLI boundary with explicit, bounded PR review input and deterministic validation. Add a package-local test suite without changing the root application Vitest scope.

### Changes Required

#### 1. Review input, prompt, and output validation

**Files**: `packages/code-review/review.ts`, `packages/code-review/common/review-schema.ts`

**Intent**: Make reviewer behavior deterministic around untrusted input and structured model output while preserving provider compatibility and the existing nested/legacy-flat response support.

**Contract**:

- Replace `review(diff)` with an explicit input object containing required non-empty `title`, optional `description`, and required non-empty `diff`.
- Accept title and description through safe CLI inputs such as files or environment values; continue reading the diff from a path or stdin without shell interpolation.
- Reject descriptions above 10,000 characters and diffs above 200 KiB before starting Codex. Reject empty input instead of loading a sample.
- Keep sample fixtures available only through an explicit local-development command/argument that cannot activate accidentally in CI.
- Build one prompt that clearly delimits title, description, and diff as untrusted review data and instructs the model not to follow instructions found inside them.
- Preserve the provider-compatible JSON schema, then post-validate every score as an integer from 1 through 10 and require non-empty rationales and summary.
- Keep the model-emitted `pass`/`fail` verdict authoritative and preserve nested plus legacy-flat response parsing.
- Keep credential filtering and the read-only/no-web/no-approval thread configuration unchanged.

#### 2. Package-local deterministic test harness

**Files**: `packages/code-review/package.json`, `packages/code-review/package-lock.json`, `packages/code-review/review.test.ts`

**Intent**: Give the standalone reviewer package a fast test command that does not depend on root Vitest configuration or live model access.

**Contract**:

- Add `vitest` 4.1.6 as a package dev dependency and `test` script using `vitest run`.
- Cover title/description/diff prompt assembly, explicit sample usage, empty input, both size limits, prompt-injection delimiters, nested output, legacy-flat output, invalid JSON, invalid scores, and empty rationales/summary.
- Keep SDK/provider calls outside deterministic tests by testing pure input/parse/validation seams.
- Split test or implementation files only if needed to remain within the repository's 220-line TypeScript limit.

### Success Criteria

#### Automated Verification

- `npm ci --prefix packages/code-review` succeeds from the package lockfile.
- `npm test --prefix packages/code-review` passes without provider credentials or network access.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review the generated prompt and confirm PR content is delimited as untrusted data rather than executable instructions.
- Run the explicit local sample path and confirm empty CI-style input cannot select it.

**Implementation Note**: After automated verification passes, pause for human confirmation of the prompt boundary and explicit sample behavior before proceeding.

---

## Phase 2: Extract the Composite Review Action

### Overview

Create a local composite action that owns reviewer setup and execution and returns validated results through safe GitHub Actions outputs.

### Changes Required

#### 1. Composite action metadata and execution

**File**: `.github/actions/code-review/action.yml`

**Intent**: Replace duplicated provider-specific workflow steps with one reusable, review-focused action while keeping repository policy outside the action.

**Contract**:

- Declare required `title` and `diff-path` inputs, optional `description` and `model` inputs, and a required `provider` limited by reviewer validation to `openai` or `openrouter` in CI.
- Expose `verdict`, `summary`, and `result-path` outputs only after the reviewer result passes deterministic validation.
- Install `packages/code-review` from its lockfile and invoke one provider-neutral reviewer command.
- Receive provider credentials only from caller-supplied environment variables; do not declare defaults, print values, or grant permissions.
- Export multiline summary content with a collision-resistant delimiter or equivalent file-based mechanism, never the current fixed `CODEX_REVIEW` delimiter.
- Keep the full validated JSON at `result-path` for same-job diagnostics without treating the runner filesystem as cross-job storage.

#### 2. Composite contract verification

**Files**: `packages/code-review/review.test.ts`, `.github/actions/code-review/action.yml`

**Intent**: Verify the executable contracts behind the action without making paid provider calls.

**Contract**:

- Extend reviewer tests for provider selection, missing provider credentials, safe result serialization, and multiline summary output encoding.
- Format-check the action metadata and reserve end-to-end action execution for the real GitHub smoke in Phase 4.

### Success Criteria

#### Automated Verification

- `npm test --prefix packages/code-review` passes with action-facing input/output contract coverage.
- `pnpm exec prettier --check ".github/**/*.{yml,yaml}"` passes.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review `action.yml` and confirm it grants no permissions and contains no provider secret defaults.
- Confirm all local-action files come from the trusted base checkout in the calling workflow design.

**Implementation Note**: After automated verification passes, pause for human confirmation of the composite action's secret and permission boundary.

---

## Phase 3: Implement PR Publication, Retry, and Fail-Closed Gating

### Overview

Refactor the AI review workflow to call the composite action, normalize every terminal outcome, publish one comment and one outcome label, consume retries, and make the gate fail closed.

### Changes Required

#### 1. Workflow triggers, eligibility, and review execution

**File**: `.github/workflows/review.yml`

**Intent**: Support normal PR updates and explicit retries without exposing secrets to unsupported PR sources or running on unrelated label changes.

**Contract**:

- Retain `opened`, `synchronize`, and `reopened`; add `labeled` and accept it only when the added label is `ai-cr:review`.
- Retain manual dispatch and per-PR concurrency cancellation.
- Retain same-repository-only PR eligibility and the trusted base-SHA checkout with no persisted credentials.
- Generate a three-dot diff with reduced but useful context and fail before review when it is empty or above 200 KiB.
- Pass the event title, description, diff path, provider, and model to the composite action without embedding untrusted PR text in shell source.
- Capture action failure into normalized execution status and a safe diagnostic so publication can run; do not allow the final gate to interpret capture as success.
- Expose normalized execution status, verdict, summary/diagnostic, and result state to downstream jobs.

#### 2. Idempotent comment and label publication

**Files**: `.github/scripts/publish-code-review.cjs`, `.github/workflows/review.yml`, `packages/code-review/publish-code-review.test.ts`

**Intent**: Make PR side effects deterministic, independently testable, and repeatable across synchronize and retry runs.

**Contract**:

- Extract the marker-comment and label reconciliation logic into a small trusted-base helper callable from `actions/github-script`.
- Match the existing marker only on the GitHub Actions bot comment, then update it or create one comment.
- Distinguish a model `fail` summary from an execution diagnostic without exposing secrets or raw model responses.
- Ensure labels exist with stable names and colors: green `ai-cr:passed`, red `ai-cr:failed`, yellow `ai-cr:error`, and blue `ai-cr:review`.
- Reconcile outcome labels so exactly one of passed/failed/error remains after terminal publication.
- Preserve the previous outcome while retry is pending, then remove `ai-cr:review` during terminal reconciliation so another retry can be requested.
- Give only the publication job `pull-requests: write` and `issues: write`; retain read-only permissions elsewhere.
- Unit-test comment create/update, bot-marker selection, each outcome mapping, opposite-label removal, retry removal, label provisioning, and API failure propagation with mocked GitHub APIs.

#### 3. Always-running authoritative gate

**File**: `.github/workflows/review.yml`

**Intent**: Make the required check fail on review rejection, execution failure, or publication failure instead of skipping.

**Contract**:

- Run the gate with `always()` for eligible review events after both review and publication jobs.
- Succeed only when review execution completed successfully, verdict is `pass`, and publication succeeded.
- Fail on model `fail`, `ai-cr:error` conditions, or publication failure.
- Skip unsupported fork PRs and unrelated label events consistently across review, publication, and gate jobs.

### Success Criteria

#### Automated Verification

- `npm test --prefix packages/code-review` passes with publication-helper coverage.
- A pinned `actionlint` check passes for `.github/workflows/ci.yml` and `.github/workflows/review.yml`.
- `pnpm exec prettier --check ".github/**/*.{yml,yaml}"` passes.
- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review job permissions and confirm only publication has PR/Issues write access.
- Review event predicates and confirm unrelated labels and fork PRs cannot access provider secrets.
- Confirm the gate truth table covers pass, model fail, execution error, and publication error.

**Implementation Note**: After automated verification passes, pause for human confirmation of permissions, event eligibility, and the gate truth table before enabling the workflow on a real PR.

---

## Phase 4: Align CI, Documentation, and Real GitHub Verification

### Overview

Make `main` the consistent CI target, enforce all deterministic quality gates, document the new commands and behavior, and validate the complete workflow through controlled same-repository PR runs.

### Changes Required

#### 1. Ordinary CI quality gates

**File**: `.github/workflows/ci.yml`

**Intent**: Complete the deferred quality-gate rollout so application and reviewer regressions block merges to `main` without live model cost.

**Contract**:

- Change push and PR filters from `master` to `main`.
- After root `npm ci`, run Astro sync and `npm run test:app`.
- Install the standalone reviewer with `npm ci --prefix packages/code-review` and run `npm test --prefix packages/code-review`.
- Add an immutable-version/pinned actionlint check for workflow files.
- Preserve root lint and build, including existing build-time Supabase environment handling.
- Do not add Playwright, database tests, or live reviewer/provider invocation to ordinary CI.

#### 2. User and testing documentation

**Files**: `README.md`, `context/foundation/test-plan.md`

**Intent**: Keep repository onboarding and the test-strategy source of truth aligned with executable CI behavior.

**Contract**:

- Update README scripts and CI sections to describe `main`, `test:app`, package-local reviewer tests, and the absence of live provider calls in deterministic CI.
- Update test-plan Quality Gates and cookbook guidance with the reviewer test command, workflow validation, and AI-review smoke boundary.
- Advance foundation rollout Phase 4 status only when implementation and verification are complete, not when files are merely edited.
- Document that fork PRs are intentionally unsupported by AI review and that `ai-cr:error` represents review execution, validation, or context failure; publication failure is surfaced by the gate.

#### 3. Controlled GitHub smoke matrix

**Files**: GitHub workflow runs and a temporary same-repository pull request; no permanent fixture file required

**Intent**: Verify behavior that local unit/static checks cannot prove: event delivery, permissions, secrets, comments, labels, concurrency, and required-check results.

**Contract**:

- Verify open PR review and a synchronize event that cancels/replaces stale work.
- Verify model pass produces one updated marker comment, only `ai-cr:passed`, and a passing gate.
- Verify model fail produces only `ai-cr:failed` and a failing gate.
- Verify missing/invalid provider configuration or an intentionally invalid bounded input produces only `ai-cr:error`, a safe diagnostic comment, and a failing gate.
- Add `ai-cr:review` twice across completed runs; confirm each triggers a retry and the retry label is consumed at terminal reconciliation.
- Verify manual dispatch still produces a workflow summary without attempting PR publication.
- Verify an unrelated label and a fork-origin PR do not enter the privileged review path.

### Success Criteria

#### Automated Verification

- `npm run test:app` passes without provider credentials or network calls.
- `npm test --prefix packages/code-review` passes without provider credentials or network calls.
- Pinned actionlint and GitHub YAML formatting checks pass.
- `pnpm run lint` passes.
- `pnpm run build` passes.
- The ordinary CI workflow succeeds on a same-repository PR to `main`.

#### Manual Verification

- Complete and record the controlled GitHub smoke matrix for pass, fail, error, retry, synchronize, manual dispatch, unrelated-label, and fork cases.
- Confirm one marker comment and exactly one terminal outcome label remain after every completed PR review.
- Confirm no secret value, raw provider response, or untrusted PR content appears in error diagnostics or workflow logs beyond the intended review summary.

**Implementation Note**: Do not mark this phase complete until the human confirms the real GitHub smoke results. If repository secrets or branch-protection access are unavailable, leave the relevant Progress items pending and report the external blocker.

---

## Testing Strategy

### Unit Tests

- Package-local Vitest covers input bounds, explicit sample behavior, prompt construction, nested/flat parsing, strict score/text validation, provider selection, output serialization, and GitHub publication logic.
- All SDK/provider boundaries are mocked or bypassed; deterministic tests must not require `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, saved Codex login, or network access.
- Publication tests use mocked GitHub Issues API methods and assert final state rather than call order where order is not contractually important.

### Static and Integration Checks

- A pinned actionlint version validates workflow event expressions, job dependencies, and GitHub Actions syntax.
- Prettier validates YAML parse/format consistency, including the composite action metadata.
- Root application Vitest, lint, and production build remain required.
- The real same-repository PR smoke is the integration test for composite-action execution, permissions, labels, comments, and gate results.

### Manual Testing Steps

1. Create a same-repository branch and PR to `main` containing a safe, reviewable change.
2. Observe open and synchronize runs, including concurrency cancellation.
3. Exercise pass, model-fail, and execution-error outcomes with controlled inputs/configuration.
4. Verify the comment and mutually exclusive labels after each terminal outcome.
5. Add `ai-cr:review`, wait for completion and removal, then add it again and verify a second retry.
6. Trigger manual dispatch and confirm it writes a workflow summary without PR mutation.
7. Add an unrelated label and verify no review jobs run.
8. Verify a fork-origin PR cannot enter the secret-bearing review path.

## Performance Considerations

- Description input is capped at 10,000 characters and diff input at 200 KiB before the model call; neither is silently truncated.
- Reduce diff context from the current 80 lines to a smaller review-appropriate context while preserving the complete changed hunks within the hard byte limit.
- Per-PR concurrency continues canceling obsolete review runs.
- Ordinary CI gains two deterministic Vitest suites and a static workflow check, but no browser, database, or live-model latency.

## Migration and Rollback Notes

- No database or application data migration is required.
- The reviewer package lockfile changes independently; root lockfiles change only if root tooling dependencies/scripts are added.
- Workflow rollout is reversible by restoring the previous `review.yml`; label/comment state is non-destructive and can be cleaned manually.
- Existing PR comments are reused through the marker. New labels may remain in the repository after rollback but have no effect without subscribed workflow behavior.
- Branch-protection configuration is a human-owned external step; do not remove the previous required check until the new authoritative gate has passed the smoke matrix.

## References

- Requirements: `context/changes/ci-cd-code-review-verification-and-improvement/requirements.md`
- Research: `context/changes/ci-cd-code-review-verification-and-improvement/research.md`
- Change identity: `context/changes/ci-cd-code-review-verification-and-improvement/change.md`
- Test rollout: `context/foundation/test-plan.md`
- Current AI review workflow: `.github/workflows/review.yml`
- Current ordinary CI: `.github/workflows/ci.yml`
- Reviewer entry point: `packages/code-review/review.ts`
- Reviewer schema and rubric: `packages/code-review/common/review-schema.ts`
- Prior deterministic-test plan: `context/archive/2026-06-09-testing-critical-prepare-viewing-flow/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Harden and Test the Reviewer Contract

#### Automated

- [x] 1.1 `npm ci --prefix packages/code-review` succeeds from the package lockfile. — 44860f1
- [x] 1.2 `npm test --prefix packages/code-review` passes without provider credentials or network access. — 44860f1
- [x] 1.3 `pnpm run lint` passes. — 44860f1
- [x] 1.4 `pnpm run build` passes. — 44860f1

#### Manual

- [x] 1.5 Review the generated prompt and confirm PR content is delimited as untrusted data rather than executable instructions. — 44860f1
- [x] 1.6 Run the explicit local sample path and confirm empty CI-style input cannot select it. — 44860f1

### Phase 2: Extract the Composite Review Action

#### Automated

- [x] 2.1 `npm test --prefix packages/code-review` passes with action-facing input/output contract coverage. — 18c06d8
- [x] 2.2 `pnpm exec prettier --check ".github/**/*.{yml,yaml}"` passes. — 18c06d8
- [x] 2.3 `pnpm run lint` passes. — 18c06d8
- [x] 2.4 `pnpm run build` passes. — 18c06d8

#### Manual

- [x] 2.5 Review `action.yml` and confirm it grants no permissions and contains no provider secret defaults. — 18c06d8
- [x] 2.6 Confirm all local-action files come from the trusted base checkout in the calling workflow design. — 18c06d8

### Phase 3: Implement PR Publication, Retry, and Fail-Closed Gating

#### Automated

- [x] 3.1 `npm test --prefix packages/code-review` passes with publication-helper coverage.
- [x] 3.2 A pinned `actionlint` check passes for `.github/workflows/ci.yml` and `.github/workflows/review.yml`.
- [x] 3.3 `pnpm exec prettier --check ".github/**/*.{yml,yaml}"` passes.
- [x] 3.4 `pnpm run lint` passes.
- [x] 3.5 `pnpm run build` passes.

#### Manual

- [x] 3.6 Review job permissions and confirm only publication has PR/Issues write access.
- [x] 3.7 Review event predicates and confirm unrelated labels and fork PRs cannot access provider secrets.
- [x] 3.8 Confirm the gate truth table covers pass, model fail, execution error, and publication error.

### Phase 4: Align CI, Documentation, and Real GitHub Verification

#### Automated

- [ ] 4.1 `npm run test:app` passes without provider credentials or network calls.
- [ ] 4.2 `npm test --prefix packages/code-review` passes without provider credentials or network calls.
- [ ] 4.3 Pinned actionlint and GitHub YAML formatting checks pass.
- [ ] 4.4 `pnpm run lint` passes.
- [ ] 4.5 `pnpm run build` passes.
- [ ] 4.6 The ordinary CI workflow succeeds on a same-repository PR to `main`.

#### Manual

- [ ] 4.7 Complete and record the controlled GitHub smoke matrix for pass, fail, error, retry, synchronize, manual dispatch, unrelated-label, and fork cases.
- [ ] 4.8 Confirm one marker comment and exactly one terminal outcome label remain after every completed PR review.
- [ ] 4.9 Confirm no secret value, raw provider response, or untrusted PR content appears in error diagnostics or workflow logs beyond the intended review summary.
