# Opportunity Map

## Context

- **Project / context**: Forge app deployment after coding-LLM implementation tasks.
- **Data constraint**: Local Forge CLI output and non-sensitive app metadata. Browser confirmation requires a least-privilege test identity and workspace before use.
- **Date**: 2026-06-20

## Map

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Deploy success does not prove the new version is testable; notifications from separate runs can be confused. | Cursor hook runs Forge commands and sends notifications. | Add a deployment run ID, durable run log, and readiness evidence tied to that run. | Local wrapper emits a run ID, captures output and timestamps, and returns one final status per run. | Local, non-sensitive. | Internal deployment-readiness tool. |
| Manifest-level changes can require a follow-up Forge command that is easy to miss in CLI output. | Notification attempts to detect the message. | Return an explicit action-required status with the exact follow-up command and run ID. | Wrapper classifies each run as ready, action required, or failed. | Local, non-sensitive. | Internal deployment-readiness tool. |

## Recommended First Candidate

**Candidate:** Forge deployment readiness wrapper

**Reads:** Forge CLI stdout/stderr and local timestamps.

**Returns:** A durable per-run report with an ID, status, relevant CLI evidence, and any required follow-up command.

**Does not do:** Replace Forge deployment, execute inferred follow-up commands automatically, or use browser automation.

**Data risk:** Local and non-sensitive initially. Any browser-based confirmation must use a dedicated, least-privilege test account and workspace rather than a privileged Atlassian account.

**Direction if it proves valuable:** Internal deployment-readiness tool with an optional opt-in readiness probe.

## Why This Candidate

It addresses both pains at the source: CLI completion is not treated as hosted readiness, and required manual actions cannot be hidden inside a generic success notification.

## Next Direction If Valuable

Add an opt-in readiness probe against a dedicated test environment. It should provide evidence that the intended deployment is available without using a privileged user session.
