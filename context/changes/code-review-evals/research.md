---
date: 2026-07-26T15:57:32+02:00
researcher: Codex
git_commit: ea0693d1634c7301bc5f382be4593caa6b626ea1
branch: main
repository: 10x-new-flat
topic: "Analyze the current state of '@packages/code-reviewer' in the context of potential eval introduction - reusability of prompts, importability of agent, etc. My first pick for eval toolkit is promptfoo. If my tech stack is aligned with this tool, go in that direction. Otherwise, you can analyze other oss tools allowing me to eval my prompts and agents. Use Web Search or context7 to get the most up to date docs."
tags: [research, code-review, evaluations, promptfoo, codex-sdk]
status: complete
last_updated: 2026-07-26
last_updated_by: Codex
---

# Research: Code-review evaluation readiness

**Date**: 2026-07-26T15:57:32+02:00
**Researcher**: Codex
**Git Commit**: ea0693d1634c7301bc5f382be4593caa6b626ea1
**Branch**: main
**Repository**: 10x-new-flat

## Research Question

Analyze the current code reviewer for prompt and agent evaluation readiness, then recommend an OSS evaluation toolkit, preferring Promptfoo when it fits the TypeScript/Node stack.

## Summary

The requested `packages/code-reviewer` directory does not exist; the relevant package is `packages/code-review`. Promptfoo is a strong fit and should be the first evaluation tool: it is Node/TypeScript-native, supports custom JavaScript/TypeScript providers, programmatic `evaluate()` usage, JavaScript assertions, and CI execution. No Python service or second runtime is required.

The reviewer is ready for prompt-contract evaluation today. Its system prompt, JSON schema, input validation, prompt construction, and response parsing are independently exported. It is not yet cleanly reusable as an in-process agent target because `review()` creates a private Codex client from mutable process environment and calls the SDK directly. A small runner-injection refactor is the key prerequisite for durable full-agent evaluations.

## Detailed Findings

### Existing reviewer architecture

- The trusted workflow checks out the base revision, constructs a bounded diff (at most 204,800 bytes), then invokes the composite action. [review workflow](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/.github/workflows/review.yml#L33-L80)
- The action installs the package, validates an OpenAI/OpenRouter credential, runs `review.ts`, and exports validated JSON-derived outputs. [composite action](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/.github/actions/code-review/action.yml#L29-L53)
- The production agent runs read-only, with approvals and web search disabled, then parses the SDK response through the runtime contract. [review agent](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/review.ts#L147-L162)

### Prompt and contract reusability

- `REVIEWER_PROMPT` and its draft-07 output schema are exported from one module. [review schema](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/common/review-schema.ts#L82-L101)
- `buildReviewPrompt()` is a pure exported function; it validates input and explicitly marks PR title, description, and diff as untrusted data. [prompt assembly](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/review-contract.ts#L26-L59)
- `parseReview()` independently validates JSON, canonical/legacy shapes, integer score bounds, and non-empty review text. [response contract](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/review-contract.ts#L65-L85)
- This creates an immediate low-risk eval layer: fixture input -> built prompt -> structural/security assertions, without a live model call.

### Agent importability and test seams

- `review()` is exported, but it constructs its own private `Codex` client from process environment and invokes `thread.run()` itself. [client configuration](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/review.ts#L86-L145) and [agent call](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/review.ts#L147-L161)
- The package has no public export map or stable package identity; its package name is `packages`. [package manifest](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/package.json#L1-L20)
- Existing tests cover input limits, injection framing, parsing, action contracts, and publication behavior, but not a fake-runner execution of the agent or expected semantic findings from fixtures. [review tests](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/review.test.ts#L31-L132)
- The two current samples are diff-only and receive the same synthetic title, so they are not sufficient as explicit eval cases. [sample loader](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/packages/code-review/review-contract.ts#L88-L99)

### Promptfoo fit

- Promptfoo's Node API supports TypeScript evaluation suites through `evaluate()` with prompts, providers, tests, and assertions. [official Node API docs](https://www.promptfoo.dev/docs/usage/node-api-reference/)
- Custom JavaScript/TypeScript providers can wrap arbitrary application calls, which lets an eval call the real code-review runner rather than reimplementing its logic. [custom provider docs](https://www.promptfoo.dev/docs/providers/custom-api/)
- JavaScript assertions can return pass/fail, score, and reason, matching structural and rubric-oriented checks needed for code-review output. [JavaScript assertion docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/)
- Promptfoo supports local/CI execution and a GitHub Action, so it fits the existing npm/GitHub Actions delivery path. [CI/CD docs](https://www.promptfoo.dev/docs/integrations/ci-cd/) and [GitHub Action docs](https://www.promptfoo.dev/docs/integrations/github-action/)

### Alternatives considered

- **DeepEval** is credible for agent evaluation but is Python/pytest-first. Introducing it would add a separate runtime and harness to this TypeScript package, so it is not the right first choice. [DeepEval introduction](https://deepeval.com/docs/introduction)
- **Langfuse** is OSS and offers JS/TS experiments and code evaluators. It is a better later addition for shared traces, datasets, dashboards, and production observability, but it needs a service and is disproportionate for the first local/CI regression suite. [Langfuse experiment model](https://langfuse.com/docs/evaluation/experiments/data-model) and [code evaluators](https://langfuse.com/docs/evaluation/evaluation-methods/code-evaluators)

## Architecture Insights

Use two eval layers:

1. **Deterministic contract evals**: fixtures exercise `buildReviewPrompt()` and `parseReview()`; assert untrusted-data framing, schema validity, required criteria, and known malformed responses.
2. **Live agent evals**: a Promptfoo custom provider invokes the production runner; assertions check valid structured output, expected verdict, score/finding bounds, and false-positive constraints instead of exact prose.

Before layer 2, extract a minimal `ReviewRunner` boundary such as `run(prompt, schema): Promise<string>`. Keep `review()` as the production composition root, but let tests and the Promptfoo provider supply a fake or real runner. Add a public `index.ts`/`exports` surface and give the package a stable scoped name. Make fixtures explicit `{ title, description, diff, expected }` records, pin the evaluation model, and capture model/provider/version metadata with every run.

Do not evaluate through the publishing workflow: it has repository side effects and mixes delivery behavior with agent quality. Live evals should run in an isolated fixture checkout or a runner mode without ambient repository/tool access; the current SDK call skips the git-repo check.

## Recommended Direction

Proceed with Promptfoo. Start package-local, for example `packages/code-review/evals/`, and retain Vitest for deterministic unit contracts. Add Promptfoo only for the fixture corpus and live/model-assisted checks. Initially run it as an opt-in or non-blocking CI job; establish a baseline before making a regression threshold required.

## Historical Context

No prior change research relevant to the code-review package was found. The current package tests already run as a separate CI step. [CI workflow](https://github.com/marcinstaszczyk/10xNewFlat/blob/ea0693d1634c7301bc5f382be4593caa6b626ea1/.github/workflows/ci.yml#L18-L28)

## Related Research

None.

## Open Questions

- Which model/provider should define the first stable baseline, and what cost/run-frequency budget is acceptable?
- Should a failed live eval block pull requests immediately, or only report until the fixture corpus is calibrated?
- Is preserving acceptance of the legacy flat response shape intentional for future evaluations, or should the nested shape become the only canonical output?
