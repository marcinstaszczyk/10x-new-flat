# Promptfoo code-review evaluation implementation plan

## Overview

Add a package-local, manually run Promptfoo suite that submits the existing code-review prompt to three OpenRouter models: `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`, and `openai/gpt-5.6-luna`. It will assess one deliberately flawed transfer diff. Deterministic assertions must reject malformed or passing review results and enforce low scores for materially broken areas; Luna will then judge whether each response identifies all three seeded flaws.

The suite is intentionally local-only. It must not run from the existing CI or AI-review publishing workflow, and it must use only `OPENROUTER_API_KEY` supplied by the developer.

## Current State Analysis

`packages/code-review` already owns the reviewer prompt, output schema, validation, and parser. `buildReviewPrompt()` creates the trusted/untrusted-data boundary used by production, while `parseReview()` validates normalized structured output. The package has its own npm dependency graph and CI invokes only its Vitest suite. The current sample diffs are raw input samples, not semantic evaluation cases.

Promptfoo supports TypeScript configuration, multiple OpenRouter providers, JavaScript assertions, and `llm-rubric` judging. Its direct providers evaluate a prompt, not the Codex SDK tool loop. That is the desired scope: compare the same reviewer prompt across the three selected models without changing the production workflow.

## Desired End State

- A developer can run one package-local command with `OPENROUTER_API_KEY` and receive a Promptfoo comparison of all three requested models against the same complex review case.
- The evaluated prompt is produced through the existing reviewer prompt builder; no duplicate copy of the system prompt or PR-data framing can drift.
- Each model response must be valid canonical review JSON, return `verdict: "fail"`, and score implementation correctness, test-risk coverage, and security/safety at or below defined failure thresholds.
- Luna judges whether the response correctly identifies the fixture's authorization, input-validation, and transactional-integrity flaws.
- Standard package tests, root linting, and build remain network-free and do not need an OpenRouter key.

## What We're NOT Doing

- Evaluating the Codex SDK thread, tool use, GitHub action, publication helper, or review workflow end-to-end.
- Adding paid evaluations to required CI, a GitHub Action, retries, result storage, dashboards, or historical trend tracking.
- Supporting arbitrary model selection in this first suite.
- Expanding the corpus beyond one intentionally complex regression fixture.
- Changing the production review rubric, provider selection, or review publication behavior.

## Critical Implementation Details

- Promptfoo's score direction is 1=worst and 10=best. Static failure checks therefore use maximum tolerated scores, not minimum scores: implementation correctness, test-risk coverage, and security/safety must each be `<= 4`.
- The judge model is also one model under test. This is accepted for the first local comparison; preserve the judge identity in the generated report so the self-judged Luna row is visible.
- The fixture must include exactly three intended material defects. Its deliberately under-scoped happy-path test is supporting context for test-risk coverage, not a fourth required finding.

## Phase 1: Establish reusable evaluation inputs and fixture contracts

### Overview

Create a single source of truth for rendering the review prompt and describe the expected outcome of the regression fixture before adding live providers.

### Changes Required

#### 1. Reusable review prompt renderer

**Files**: `packages/code-review/review-contract.ts`, `packages/code-review/review.test.ts`

**Intent**: Let the production reviewer and a TypeScript Promptfoo configuration render byte-for-byte equivalent review requests without copying the system prompt or untrusted-data envelope.

**Contract**:

- Keep `buildReviewPrompt()` as the production API and expose the smallest additional typed rendering surface the eval config needs.
- The surface accepts explicit title, optional description, and diff values; it preserves validation, newline normalization, and untrusted-data framing.
- Add deterministic tests proving the eval-oriented renderer produces the same result as the production builder for complete and description-free input.

#### 2. Canonical critical-transfer fixture

**Files**: `packages/code-review/evals/fixtures/critical-transfer.ts`, `packages/code-review/evals/fixtures/critical-transfer.test.ts`

**Intent**: Provide one realistic TypeScript transfer endpoint change that is large enough to require review reasoning but has unambiguous expected failures.

**Contract**:

- Export one fixture with PR title, description, unified diff, expected `fail` verdict, expected score ceilings, and three semantic expected findings.
- The diff implements a transfer endpoint and includes only these intended material defects:
  - the source account is selected/mutated from body-supplied `fromAccountId` without binding it to the authenticated user, enabling an IDOR;
  - a negative amount bypasses validation and reverses debit/credit behavior;
  - sufficient-funds checking and balance writes occur as separate non-transactional operations, enabling concurrent double-spend/overdraft.
- Include a narrow successful-transfer test in the diff to make the missing negative, authorization, and concurrency coverage visible without declaring it a separate expected finding.
- Unit tests validate fixture shape, the three distinct expected-finding identifiers, the required fail verdict, and the score ceilings.

### Success Criteria

#### Automated Verification

- `npm test --prefix packages/code-review` passes, including prompt-rendering equivalence and fixture-contract tests.
- The fixture carries exactly three required semantic findings and `fail` with score ceilings for implementation correctness, test-risk coverage, and security/safety.

#### Manual Verification

- Review the diff and confirm each seeded flaw is independently actionable and understandable without repository context.

---

## Phase 2: Add the local Promptfoo comparison suite

### Overview

Install Promptfoo in the standalone reviewer package and configure a TypeScript evaluation suite that renders the shared review prompt for all requested OpenRouter models.

### Changes Required

#### 1. Package-local Promptfoo runtime

**Files**: `packages/code-review/package.json`, `packages/code-review/package-lock.json`, `packages/code-review/.env.example`, `.gitignore`

**Intent**: Make the live suite reproducible from the package without changing root dependencies or exposing credentials/results.

**Contract**:

- Add Promptfoo as a package development dependency and add an explicit local evaluation script, separate from `test` and `review`.
- Regenerate only `packages/code-review/package-lock.json`.
- Document `OPENROUTER_API_KEY` as required for the evaluation command; do not add a real key or change the existing reviewer provider examples.
- Ignore Promptfoo's generated local result/cache artifacts while retaining committed config, fixture, rubric, and assertion source.

#### 2. Shared-prompt Promptfoo configuration

**Files**: `packages/code-review/evals/promptfooconfig.ts`, `packages/code-review/evals/run.ts`

**Intent**: Evaluate the actual production prompt composition against the fixed three-model matrix rather than a copied prompt string.

**Contract**:

- Load the Phase 1 fixture and construct the Promptfoo prompt through the shared renderer.
- Configure exactly these providers with deterministic temperature `0`:
  - `openrouter:z-ai/glm-5.1`
  - `openrouter:deepseek/deepseek-v4-flash`
  - `openrouter:openai/gpt-5.6-luna`
- Require `OPENROUTER_API_KEY` before network activity and fail with a clear, secret-safe configuration message when absent.
- Save a local machine-readable result report that identifies the provider/model and judge model for each row.

#### 3. Static and judge-based assertions

**Files**: `packages/code-review/evals/assertions/review-result.ts`, `packages/code-review/evals/rubrics/critical-transfer.md`, `packages/code-review/evals/promptfooconfig.ts`

**Intent**: Separate deterministic response-contract checks from semantic LLM judging so a pass verdict or invalid shape can never be excused by judge prose.

**Contract**:

- Add static assertions that parse canonical nested review JSON, reuse the review parser for runtime validation, require `verdict === "fail"`, and require scores `<= 4` for implementation correctness, test-risk coverage, and security/safety.
- Use an `llm-rubric` assertion with `openrouter:openai/gpt-5.6-luna` at temperature `0` as judge.
- The rubric passes only when the review correctly identifies all three expected defects with causal accuracy: ownership/authorization, positive-amount validation, and atomic concurrency-safe balance mutation.
- The rubric must reject materially false critical claims, but it must not demand exact wording or prohibit valid additional observations.

### Success Criteria

#### Automated Verification

- `npm ci --prefix packages/code-review` succeeds from the committed package lockfile.
- `npm test --prefix packages/code-review` passes without `OPENROUTER_API_KEY` or network access.
- With `OPENROUTER_API_KEY` configured, the local evaluation command completes and produces three model rows, each with static assertion and Luna-judge results.
- Without `OPENROUTER_API_KEY`, the local evaluation command fails before calling a provider and prints no secret value.

#### Manual Verification

- Inspect the Promptfoo report and confirm all three requested model IDs ran against the same fixture and prompt.
- Confirm the report makes it clear when Luna is judging its own response.

---

## Phase 3: Document local operation and protect existing automation boundaries

### Overview

Document the one-command local workflow and verify that existing CI and pull-request publishing remain untouched and free of paid provider calls.

### Changes Required

#### 1. Evaluation usage documentation

**Files**: `packages/code-review/README.md` (new) or the relevant `README.md` section, `packages/code-review/.env.example`

**Intent**: Make it clear how to run the suite, what it costs, what its results mean, and why it is not part of required CI.

**Contract**:

- Document prerequisite Node version/package installation, `OPENROUTER_API_KEY`, the evaluation command, fixed model matrix, Luna judge, result location, and the one-fixture scope.
- State that a live failure means the affected model did not meet the baseline; it does not alter production PR labels or GitHub workflow results.
- State that tests/lint/build remain the required offline checks.

#### 2. Automation-boundary regression checks

**Files**: `packages/code-review/review.test.ts`, `.github/workflows/ci.yml`, `.github/workflows/review.yml`

**Intent**: Preserve the distinction between local paid evals and existing deterministic CI/review delivery.

**Contract**:

- Add or update a lightweight source-level test that the standard package test script does not invoke the live evaluation script.
- Do not add Promptfoo or OpenRouter-key steps to either GitHub workflow; document this as an intentional invariant in the plan implementation.

### Success Criteria

#### Automated Verification

- `npm test --prefix packages/code-review` passes without network credentials.
- `npm run lint` passes.
- `npm run build` passes.
- A workflow/configuration review confirms neither `.github/workflows/ci.yml` nor `.github/workflows/review.yml` invokes the local evaluation command.

#### Manual Verification

- Follow the documentation from a clean package install with a locally supplied key and obtain the three-model comparison.
- Verify a normal pull request remains governed only by the existing code-review workflow, not by Promptfoo.

## Testing Strategy

### Unit Tests

- Prompt rendering equivalence between production and evaluation paths.
- Fixture schema, three expected-finding identifiers, failure verdict, and score ceilings.
- Static assertion behavior for valid failing review, passing verdict, malformed JSON, flat legacy output, missing rationale, invalid score, and score above each ceiling.
- Missing-key failure happens before a provider call.

### Live Evaluation

- One local Promptfoo run sends the critical-transfer fixture to all three fixed OpenRouter models.
- Luna grades semantic coverage of all three flaws; static assertions independently enforce structure and failure severity.

### Manual Testing Steps

1. Install the package dependencies from the committed lockfile.
2. Run package tests without `OPENROUTER_API_KEY`.
3. Supply `OPENROUTER_API_KEY` locally and run the eval script.
4. Inspect the three result rows and the static/judge evidence for each.
5. Run root lint/build and confirm neither GitHub workflow changed to invoke the paid suite.

## Performance Considerations

The suite performs three system-under-test calls plus judge calls. It is deliberately local and single-fixture to bound runtime and OpenRouter cost. Temperature `0`, fixed models, and a saved report improve comparability, but live LLM output remains non-deterministic and should not be treated as a unit-test replacement.

## Migration Notes

No production migration is required. Adding Promptfoo changes only `packages/code-review` development dependencies and its package lockfile. Removing the feature later is limited to that package, its local documentation, ignored artifacts, and eval source.

## References

- Research: `context/changes/code-review-evals/research.md`
- Prompt composition: `packages/code-review/review-contract.ts:26-59`
- Output schema/rubric: `packages/code-review/common/review-schema.ts:24-101`
- Response parser: `packages/code-review/review-contract.ts:65-85`
- Package scripts/dependencies: `packages/code-review/package.json:6-20`
- Package test CI boundary: `.github/workflows/ci.yml:18-28`
- Current Promptfoo guidance: [LLM as a judge](https://www.promptfoo.dev/docs/guides/llm-as-a-judge), [OpenRouter provider](https://www.promptfoo.dev/docs/providers/openrouter/), [JavaScript assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish reusable evaluation inputs and fixture contracts

#### Automated

- [x] 1.1 Package tests pass, including prompt-rendering equivalence and fixture-contract tests.
- [x] 1.2 The fixture has exactly three required findings, a failing verdict, and required score ceilings.

#### Manual

- [x] 1.3 The complex diff makes each seeded flaw independently actionable without repository context.

### Phase 2: Add the local Promptfoo comparison suite

#### Automated

- [ ] 2.1 Package installation succeeds from the updated package lockfile.
- [ ] 2.2 Package tests pass without OpenRouter credentials or network access.
- [ ] 2.3 With a local key, the evaluation produces three model rows with static and Luna-judge results.
- [ ] 2.4 Without a local key, the evaluation fails before a provider call and exposes no secret.

#### Manual

- [ ] 2.5 The report shows all three requested models used the same prompt and fixture.
- [ ] 2.6 The report clearly identifies Luna's self-judged row.

### Phase 3: Document local operation and protect existing automation boundaries

#### Automated

- [ ] 3.1 Package tests pass without network credentials.
- [ ] 3.2 Root lint passes.
- [ ] 3.3 Root build passes.
- [ ] 3.4 Neither existing GitHub workflow invokes the local evaluation command.

#### Manual

- [ ] 3.5 The documented clean-install workflow produces the three-model comparison with a local key.
- [ ] 3.6 A normal pull request remains governed only by the existing code-review workflow.
