# AI Code Review CI/CD Verification and Improvement — Plan Brief

> Full plan: `context/changes/ci-cd-code-review-verification-and-improvement/plan.md`  
> Research: `context/changes/ci-cd-code-review-verification-and-improvement/research.md`

## What & Why

Harden the existing AI pull-request reviewer and extract its execution into a local composite action. The workflow should remain easy to reason about while reliably publishing review results, supporting retries, and failing closed when review or publication cannot complete.

## Starting Point

The repository already has a trusted-base AI review workflow and standalone Codex reviewer. It reviews only a diff, has no deterministic package tests or labels/retry handling, can skip its gate on execution errors, and ordinary CI still targets `master` without running existing app tests.

## Desired End State

Eligible same-repository PRs to `main` receive a bounded title/description/diff review and, when PR publication succeeds, one marker comment and exactly one terminal label. A composite action owns execution; the workflow owns trust, permissions, PR state, and a fail-closed gate that also catches publication failure. Ordinary CI enforces app tests, reviewer tests, workflow validation, lint, and build without live model calls.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| PR scope | Same-repository only | Preserves the current safe secret boundary. | Plan |
| Labels | `passed`, `failed`, `error` | Separates model rejection from execution/publication failure. | Plan |
| Verdict | Model-authoritative with strict validation | No numeric threshold is defined by requirements. | Plan |
| Description | 10,000-character hard limit | Bounds cost without partial review. | Plan |
| Diff | 200 KiB hard limit | Oversized partial reviews must not pass. | Plan |
| Retry | Consume after terminal publication | Keeps pending retry visible and repeatable. | Research |
| Test boundary | Package-local reviewer Vitest | Keeps root app and standalone package ownership clear. | Research |
| Ordinary CI | App plus reviewer tests | Completes deferred deterministic quality gates. | Plan |

## Scope

**In scope:**

- Explicit bounded title, description, and diff reviewer inputs.
- Strict integer 1-10 and non-empty-text result validation.
- Package-local deterministic reviewer and publication tests.
- Local composite review action.
- Retry label, marker comment, three outcome labels, and fail-closed gate.
- `main` CI alignment, app/reviewer tests, workflow validation, and documentation.
- Controlled real GitHub smoke verification.

**Out of scope:**

- Fork/Dependabot AI review, `pull_request_target`, or two-stage workflows.
- Numeric verdict thresholds, chunked diffs, and added review criteria.
- Live provider calls in deterministic CI.
- Playwright, database tests, deployment, or branch-protection automation.

## Architecture / Approach

The reviewer becomes a validated pure contract around an isolated Codex call. The composite action installs and invokes that contract. The workflow retains event eligibility, trusted base checkout, diff acquisition, secrets, write permissions, terminal publication, and gating. Publication logic is extracted into a small tested helper so YAML remains orchestration rather than business logic.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reviewer contract | Bounded inputs, strict validation, package tests | Breaking local sample/provider behavior |
| 2. Composite action | Reusable execution and safe outputs | Secret or multiline-output leakage |
| 3. PR lifecycle | Retry, comments, labels, fail-closed gate | Incorrect event/permission or terminal-state logic |
| 4. CI and verification | `main` gates, docs, real PR smoke | External secrets or GitHub settings block verification |

**Prerequisites:** Repository OpenAI or OpenRouter secret, selected model variable, permission to manage labels and run a same-repository test PR.  
**Estimated effort:** Approximately 3-4 focused sessions across four phases.

## Open Risks & Assumptions

- Same-repository-only review is an accepted exception to the phrase “every PR.”
- The new final gate will become the branch-protection authority only after smoke verification.
- Provider/model variability remains; deterministic validation prevents malformed results but cannot make model judgment deterministic.
- A pinned actionlint integration must be selected at implementation time without introducing an unmaintained root dependency.

## Success Criteria Summary

- Every eligible review reaches a passed, failed, or execution-error state; successful publication leaves one comment and one label, while publication failure makes the gate fail.
- Retry works repeatedly, and execution/publication failures fail the required gate rather than skip.
- App tests, reviewer tests, workflow validation, lint, and build pass in ordinary CI on `main` without live model calls.
