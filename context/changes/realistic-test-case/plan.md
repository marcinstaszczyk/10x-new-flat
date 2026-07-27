# Realistic code-review evaluation case implementation plan

## Overview

Add a second, project-grounded code-review evaluation fixture alongside the existing critical-transfer baseline. The new fixture models an offer edit and preparation-regeneration feature across Astro, API, services, Supabase RLS, and rendering, with exactly three seeded defects: cross-tenant updates, destructive regeneration, and stored XSS.

Both fixtures will run in the existing local paid Promptfoo command. The implementation will generalize the evaluation harness so every fixture receives its own expected-result assertion and semantic rubric rather than being evaluated against the transfer-specific checks.

## Current State Analysis

`packages/code-review` has one fully typed transfer fixture, a transfer-specific JavaScript assertion, one rubric, and a configuration that renders that fixture into a single prompt. This design is correct for one case but cannot safely accept a second: Promptfoo evaluates prompt/test combinations, so multiple rendered prompts would allow the wrong rubric to be applied to a different diff.

The application already contains the domain pattern needed for a realistic fixture: server-authenticated offer routes, owner-scoped Supabase access, immutable preparation results, and safe Astro interpolation of extractor output. The fixture must depict a credible change while deliberately violating those existing safeguards.

## Desired End State

- `npm run eval:review --prefix packages/code-review` evaluates both the existing transfer case and the new offer edit/regeneration case against the same fixed model matrix.
- Each row is fixture-labelled and receives only its own structural assertion and LLM rubric.
- The new diff contains exactly three intended, independently actionable flaws and no test-file changes.
- Package tests remain offline and verify the two fixture contracts plus generalized assertion behavior.

### Key Discoveries

- [`packages/code-review/evals/promptfooconfig.ts:1`](../../../packages/code-review/evals/promptfooconfig.ts#L1) currently imports and renders one fixture directly.
- [`packages/code-review/evals/assertions/review-result.ts:6`](../../../packages/code-review/evals/assertions/review-result.ts#L6) imports transfer expectations, so it must become a fixture-parameterized factory.
- [`src/lib/services/offer-preparation.ts:44`](../../../src/lib/services/offer-preparation.ts#L44) presently preserves a result by rejecting re-runs before calling the extractor.
- [`supabase/migrations/20260605100000_create_flat_offers.sql:43`](../../../supabase/migrations/20260605100000_create_flat_offers.sql#L43) intentionally denies offer updates; [`src/components/offers/OfferPreparationResult.astro:111`](../../../src/components/offers/OfferPreparationResult.astro#L111) safely renders evidence text today.

## What We're NOT Doing

- Replacing or modifying the generic critical-transfer fixture.
- Adding test files to the embedded offer-regeneration diff.
- Changing production application code, migrations, RLS policies, or UI behavior.
- Adding CI execution, provider/model changes, dashboards, trend storage, or arbitrary fixture selection.
- Running the paid Promptfoo evaluation without a user-supplied `OPENROUTER_API_KEY`.

## Implementation Approach

Move the shared fixture result contract into a small fixture-types module and register both cases in a single immutable fixture list. Configure Promptfoo with one variableized prompt and one generated test per fixture. Each test supplies title, description, and diff variables, a structural assertion created from its expected result, and the fixture's rubric. This preserves a one-to-one relation between review input and grading contract while running both fixtures by default.

## Critical Implementation Details

Use one template prompt with fixture variables, not one rendered prompt per fixture. Promptfoo cross-products prompts and tests; multiple rendered prompts would apply each fixture's rubric to unrelated diffs. The source-only requirement applies to the embedded review diff, not to the package's deterministic fixture-contract tests.

The embedded migration must make the two intentionally flawed paths executable. It must drop the existing deny-update policy on `flat_offers`, grant the required `UPDATE` columns to `authenticated`, and create the weak `FOR UPDATE USING (true) WITH CHECK ((select auth.uid()) = buyer_id)` policy. It must also drop the deny-delete policy on `offer_extraction_results`, grant `DELETE` to `authenticated`, and create an owner-scoped delete policy. These are fixture-only migration changes: they deliberately model the regression and do not alter production schema or policies.

## Phase 1: Define the realistic fixture contract

### Overview

Create shared types and a stable registry, retain the transfer baseline unchanged in meaning, and add a project-real offer-regeneration fixture with exactly three required findings.

### Changes Required

#### 1. Shared fixture contract and registry

**Files**: `packages/code-review/evals/fixtures/types.ts`, `packages/code-review/evals/fixtures/index.ts`, `packages/code-review/evals/fixtures/critical-transfer.ts`

**Intent**: Give every evaluation case a stable ID and common expected-result shape without weakening the current transfer semantics.

**Contract**: Define a `ReviewFixture` extending `ReviewInput` with `id`, expected failed verdict, score ceilings, expected findings, and a rubric resource reference. Export a registry containing the existing critical-transfer fixture and the new fixture. Keep the current transfer title, diff, thresholds, and three findings semantically unchanged.

#### 2. Offer edit and regeneration fixture

**Files**: `packages/code-review/evals/fixtures/offer-edit-regeneration.ts`, `packages/code-review/evals/fixtures/offer-edit-regeneration.test.ts`

**Intent**: Add a complex unified diff based on real app architecture that challenges authorization, lifecycle integrity, and browser-security review skills.

**Contract**: Export a stable fixture ID, PR title/description, source-only unified diff, expected `fail` verdict, score ceilings for implementation correctness, test-risk coverage, and security/safety, plus exactly three ordered findings:

- an update policy with `USING (true)` permits cross-buyer updates despite a buyer-constrained `WITH CHECK`;
- regeneration deletes the existing extraction before calling the extractor and persisting a replacement, losing a valid result on failure;
- rich evidence uses Astro `set:html` on persisted extractor output, enabling stored XSS.

The source diff must plausibly touch an offer edit route/service, preparation service/result service, RLS migration, and `OfferPreparationResult.astro`. Its fixture-only migration must replace the existing deny-update and deny-delete policies and grant the update/delete privileges described above, so the two seeded database defects are executable. It must not contain application test-file changes; the expected test-risk score and rubric must treat missing risk coverage as evidence inferred from that absence.

#### 3. Fixture contract coverage

**Files**: `packages/code-review/evals/fixtures/critical-transfer.test.ts`, `packages/code-review/evals/fixtures/offer-edit-regeneration.test.ts`

**Intent**: Detect accidental changes to expected finding count, severity, identity, and key source markers without trying to test the deliberately vulnerable application diff.

**Contract**: Assert each fixture has exactly three unique ordered finding IDs, a failed verdict, expected score ceilings, and characteristic source markers for its three intended flaws. Preserve transfer assertions; add parallel assertions for offer regeneration.

### Success Criteria

#### Automated Verification

- `npm.cmd test --prefix packages/code-review` passes with both fixture contracts.
- The registry contains exactly the preserved transfer fixture and the new stable offer-regeneration fixture.
- The new fixture diff has no application test-file section and defines exactly three required findings.

#### Manual Verification

- Read the embedded diff and confirm all three seeded flaws are recognizable from the diff alone and none depends on undocumented repository context.

## Phase 2: Evaluate each fixture against its own grading contract

### Overview

Refactor static assertions and Promptfoo configuration so the default local run evaluates both cases without cross-applying their prompts, rubrics, or severity thresholds.

### Changes Required

#### 1. Parameterized structural assertion

**Files**: `packages/code-review/evals/assertions/review-result.ts`, `packages/code-review/evals/assertions/review-result.test.ts`, `packages/code-review/evals/promptfooconfig.test.ts`

**Intent**: Reuse the canonical review parser and failure-severity checks for every fixture while preserving fixture-specific thresholds.

**Contract**: Replace the transfer-bound assertion export with a factory accepting one fixture's expected result. The returned Promptfoo JavaScript assertion must require canonical nested review JSON, `verdict: "fail"`, and every configured score ceiling. Tests must cover transfer expectations, offer-regeneration expectations, malformed/legacy-flat output, passing verdicts, and exceeded ceilings.

#### 2. Fixture-specific semantic rubric

**Files**: `packages/code-review/evals/rubrics/offer-edit-regeneration.md`

**Intent**: Judge causal recognition of the three offer-regeneration flaws without overfitting to exact prose.

**Contract**: Require all three seeded defects, permit accurate additional observations, and reject materially false critical claims. Describe the RLS target-selection failure, delete-before-replacement failure mode, and persisted untrusted HTML execution explicitly.

#### 3. Variableized two-fixture Promptfoo configuration

**Files**: `packages/code-review/evals/promptfooconfig.ts`, `packages/code-review/evals/promptfooconfig.test.ts`

**Intent**: Run both fixtures in one local command while ensuring each row uses matching review input and grading rules.

**Contract**: Render one shared review-prompt template with title, description, and diff variables. Map the fixture registry into tests that set fixture-specific variables, description/ID, structural assertion factory result, and rubric content. Retain the existing fixed providers, judge, JSON response format, and temperature `0`. Add an import-only configuration test that makes no provider calls and asserts one shared variableized prompt, exactly one test per registry fixture, fixture ID/title/diff variables on every test, and each test's matching fixture-specific JavaScript assertion and rubric content.

### Success Criteria

#### Automated Verification

- `npm.cmd test --prefix packages/code-review` passes generalized assertion tests without credentials or network access.
- Configuration source tests confirm two fixture-labelled tests are generated from the registry and each owns a matching assertion and rubric.
- The standard package test command still does not invoke `eval:review`.

#### Manual Verification

- With `OPENROUTER_API_KEY` supplied locally, one `npm.cmd run eval:review --prefix packages/code-review` run produces a result row for each fixture/model combination and labels the fixture ID.

## Phase 3: Stabilize local results and document the expanded baseline

### Overview

Give the multi-fixture report a stable aggregate name and make the two-fixture behavior clear to developers without introducing persistence or CI coupling.

### Changes Required

#### 1. Aggregate report name

**Files**: `packages/code-review/evals/run.ts`

**Intent**: Avoid a transfer-specific filename now that the run covers a stable, extensible fixture corpus.

**Contract**: Write the local machine-readable output to `.promptfoo/code-review-results.json`; preserve the current local-only behavior and credential preflight.

#### 2. Evaluation documentation

**Files**: `packages/code-review/README.md`

**Intent**: Explain that the command runs both baseline cases, how fixture-labelled results should be interpreted, and that no trend storage or CI enforcement exists yet.

**Contract**: Update the suite scope, invocation, generated-result location, and fixed model/judge explanation. State that stable fixture IDs and report naming are preparatory for future comparisons only, not an implemented tracking feature.

### Success Criteria

#### Automated Verification

- `npm.cmd test --prefix packages/code-review` passes.
- `pnpm.cmd run lint` passes.
- `pnpm.cmd run build` passes.
- Source-level checks confirm the report path is `code-review-results.json` and documentation names both fixtures.

#### Manual Verification

- Inspect a local paid evaluation report and confirm rows are distinguishable by fixture ID, model, and judge outcome.

## Testing Strategy

### Unit Tests

- Preserve transfer fixture contract coverage.
- Add new fixture contract coverage for stable ID, exactly three flaws, score ceilings, and source-only diff boundaries.
- Test the generalized assertion factory against canonical successful failure output and invalid/non-failing output.
- Test Promptfoo configuration construction without provider calls, including one generated test per registry fixture.

### Live Evaluation

- With a locally supplied key, run the existing package command once and verify all fixed models process both fixtures.
- Treat live results as a paid qualitative baseline, not deterministic CI evidence.

### Manual Testing Steps

1. Review the new embedded diff for the exact three required findings.
2. Run package tests with no OpenRouter credential.
3. Supply `OPENROUTER_API_KEY` locally and run the evaluation command.
4. Inspect report rows for both fixture IDs and each model.
5. Run root lint and build; verify no workflow invokes the paid evaluation.

## Performance Considerations

The expanded suite doubles system-under-test fixture/model combinations and corresponding judge work. It remains local-only and uses the existing fixed providers, temperature, and machine-readable output; this is acceptable because the user chose to run both cases by default.

## Migration Notes

No application or database migration will run. The SQL migration is text embedded in an evaluation diff only. Rollback is limited to removing the fixture, registry entry, rubric, and generalized harness support.

## References

- Research: `context/changes/realistic-test-case/research.md`
- Existing fixture: `packages/code-review/evals/fixtures/critical-transfer.ts:3-100`
- Existing configuration: `packages/code-review/evals/promptfooconfig.ts:1-36`
- Offer preparation lifecycle: `src/lib/services/offer-preparation.ts:44-95`
- Offer RLS baseline: `supabase/migrations/20260605100000_create_flat_offers.sql:43-73`
- Safe evidence rendering: `src/components/offers/OfferPreparationResult.astro:102-112`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Define the realistic fixture contract

#### Automated

- [x] 1.1 Package tests pass with both fixture contracts. — b6345a3
- [x] 1.2 The registry contains the preserved transfer fixture and stable offer-regeneration fixture. — b6345a3
- [x] 1.3 The new fixture has a source-only diff and exactly three required findings. — b6345a3

#### Manual

- [x] 1.4 Each seeded flaw is independently understandable from the embedded diff. — b6345a3

### Phase 2: Evaluate each fixture against its own grading contract

#### Automated

- [x] 2.1 Package tests pass generalized assertion coverage without credentials or network access. — b93aa51
- [x] 2.2 Configuration source tests prove two fixture-labelled tests use matching assertions and rubrics. — b93aa51
- [x] 2.3 The standard package test command excludes the paid evaluation. — b93aa51

#### Manual

- [x] 2.4 A local paid evaluation produces labelled rows for every fixture/model combination. — b93aa51

### Phase 3: Stabilize local results and document the expanded baseline

#### Automated

- [x] 3.1 Package tests pass. — 947c184
- [x] 3.2 Root lint passes. — 947c184
- [x] 3.3 Root build passes. — 947c184
- [x] 3.4 Source-level checks confirm the aggregate result path and two-fixture documentation. — 947c184

#### Manual

- [x] 3.5 The local report distinguishes rows by fixture, model, and judge outcome. — 947c184
