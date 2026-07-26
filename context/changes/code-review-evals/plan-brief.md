# Promptfoo code-review evaluations — Plan Brief

> Full plan: `context/changes/code-review-evals/plan.md`
> Research: `context/changes/code-review-evals/research.md`

## What & Why

Add a local Promptfoo suite that runs the existing code-review prompt against three selected OpenRouter models and compares their ability to find a known set of high-impact defects. It gives the reviewer a repeatable quality baseline without making paid, variable LLM calls part of CI.

## Starting Point

`packages/code-review` already has a reusable system prompt, prompt builder, output schema, and parser, but no semantic regression fixtures or live model-evaluation command. Its current samples are raw diffs and package CI runs only Vitest.

## Desired End State

One local command evaluates `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`, and `openai/gpt-5.6-luna` on the identical complex transfer diff. Every result must be valid, fail, and receive low scores in broken areas; Luna then judges whether all three intended flaws were correctly found.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Toolkit | Promptfoo | It natively supports TypeScript, OpenRouter, static assertions, and LLM judging. | Research |
| Execution | Local only | Avoids paid, non-deterministic provider calls in required CI. | Plan |
| Model matrix | GLM 5.1, DeepSeek V4 Flash, GPT-5.6 Luna | Fixed user-selected comparison set. | Plan |
| Judge | GPT-5.6 Luna | Reuses the single approved OpenRouter credential and model choice. | Plan |
| Fixture | Transfer endpoint | It makes authorization, validation, and transactional integrity defects independently testable. | Plan |
| Gates | Fail verdict plus score ceilings and rubric | Static checks prevent structural/false-pass failures; the judge measures semantic quality. | Plan |

## Scope

**In scope:** shared prompt rendering; one critical-transfer fixture; static and Luna judge assertions; package-local Promptfoo script/dependency; local setup documentation; ignored result artifacts.

**Out of scope:** Codex SDK/tool-loop evaluation, CI integration, GitHub Actions, dashboards, a multi-fixture corpus, and production-review changes.

## Architecture / Approach

The evaluation config calls the same prompt renderer used by production, then sends that prompt to three fixed OpenRouter providers at temperature 0. Promptfoo applies deterministic JSON/fail/score checks first, then Luna grades semantic discovery of the three seeded flaws. Results remain local and machine-readable.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reusable inputs | Shared rendering seam and explicit three-flaw fixture | Prompt drift or ambiguous fixture |
| 2. Local comparison | Promptfoo model matrix, static assertions, Luna rubric | Model/judge variability and cost |
| 3. Guardrails | Documentation and CI-boundary protection | Accidentally adding paid calls to CI |

**Prerequisites:** Node version from `.nvmrc`, package installation, and a locally supplied `OPENROUTER_API_KEY` for live runs.
**Estimated effort:** ~2–3 focused sessions across three phases.

## Open Risks & Assumptions

- Luna grades its own model row, which can introduce bias; result metadata must make this visible.
- Fixed models may be renamed or unavailable later; the manual command should surface provider errors clearly.
- Live output remains non-deterministic even at temperature 0; the suite is a regression signal, not a replacement for deterministic tests.

## Success Criteria (Summary)

- The local command generates comparable results for all three selected models using one shared prompt and fixture.
- Static checks require valid nested JSON, `fail`, and sufficiently low correctness/test/security scores.
- Luna confirms semantic detection of IDOR, negative-amount handling, and non-atomic balance updates.
