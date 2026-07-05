# Mom Test Validation Plan

## Input Idea

Validate whether people who deploy Forge apps after coding-LLM tasks repeatedly lack trustworthy, per-run evidence that a deployment is ready, and whether missed manifest follow-up commands materially disrupt releases. The proposed solution is a local deployment-readiness wrapper that records a run ID, CLI evidence, status, and any required manual command.

## Hypotheses

- **User/role**: Developers or release owners who deploy Forge apps after implementation work.
- **Friction**: Forge CLI completion and generic notifications can be mistaken for hosted readiness; messages requiring a follow-up command can be missed.
- **Current workaround**: Reading CLI output, waiting and retrying, checking notifications, manually opening the app, or asking a teammate to confirm the deployment.
- **Proposed solution**: A local wrapper that emits a durable report for each run: ready, action required, or failed.
- **Risky assumptions**:
  - The ambiguity occurs often enough to justify a new local tool.
  - The CLI output contains enough stable signal to classify safely.
  - A run ID and report solve the actual delay rather than merely document it.
  - Existing CLI commands, logs, browser checks, or team conventions are insufficient.
  - Developers will use another command in their deployment workflow.
- **Evidence already present**: The opportunity map identifies two plausible failure modes and a low-sensitivity data boundary. It contains no interview, incident, ticket, timing, or usage evidence.

## Critique

The current proposal starts with a wrapper, not a demonstrated recurring problem. "Deploy succeeded but was not ready" and "a follow-up command was missed" are useful hypotheses only if they can be tied to recent, costly incidents. A generic success notification may be the weak point, but the actual cause could instead be an unfamiliar Forge workflow, poor ownership, a transient platform state, or a missing release checklist.

Do not ask whether people would use a readiness wrapper. Establish the last real deployment where they could not tell what to do next, what evidence they trusted, and what it cost. The strongest disconfirming result is that people can reliably use existing CLI output and a lightweight checklist, or that the incidents are rare and low-cost.

Strong evidence to proceed is repeated, unprompted descriptions of the same ambiguity from people who have deployed recently, plus measurable delay, rework, or release risk.

## Interview Guide

Use this guide with 5-7 people who have deployed a Forge app in the last 90 days. Spend 20-30 minutes per conversation. Do not demo or name the wrapper until the closing minutes, if at all.

1. What is your role, and how often have you deployed a Forge app in the last three months?
   - Follow-up: Which environments and deployment commands do you normally use?
2. Walk me through the most recent Forge deployment you personally completed, from code ready to your confidence that it was available.
   - Follow-up: What artifacts, commands, or people did you rely on at each step?
3. At what point in that deployment did you decide it was ready for someone else to use?
   - Follow-up: What concrete evidence made that convincing?
4. Tell me about the most recent deployment that did not behave as you expected.
   - Follow-up: What did the CLI say, what did you do next, and how long did resolution take?
5. Have you recently seen a message that required another deployment-related command or manual action?
   - Follow-up: What was the message, how did you notice it, and what happened if it was delayed?
6. When multiple deployments or notifications overlap, how do you determine which result belongs to which change?
   - Follow-up: Show or describe the logs, notifications, terminal history, or naming convention you use.
7. What do you do today when the CLI exits successfully but you are unsure the deployed app is usable?
   - Follow-up: How often has this happened in the last 90 days?
8. What does that uncertainty cost in elapsed time, rework, coordination, or release risk?
   - Follow-up: Describe the last incident with a concrete example.
9. What existing tools, scripts, checklists, or team practices have you tried for this?
   - Follow-up: What works well enough, and what specifically fails?
10. May I follow up on an anonymized terminal transcript, notification, or incident record from the example you described?
   - Follow-up: Who else directly experienced the same workflow?

## Survey

Screen respondents before analysis: include only people who personally deployed a Forge app within the last 90 days.

1. In the past 90 days, how many Forge deployments have you personally run? (1; 2-5; 6-10; more than 10)
2. In those deployments, how often did you need evidence beyond a successful CLI exit to decide the app was usable? (Never; once; occasionally; often; almost every time)
3. What did you use most recently to confirm readiness? (CLI output; browser/app check; notification; teammate confirmation; CI/CD log; other)
4. In the past 90 days, how often did a deploy-related CLI message require a follow-up command or manual action? (Never; once; 2-3 times; 4+ times; unsure)
5. On the last occurrence, how was the follow-up action discovered? (Read CLI output; notification; documentation; teammate; trial and error; other)
6. On the last deployment with uncertain readiness, how much time elapsed before you had a reliable answer? (Less than 5 minutes; 5-15; 16-30; 31-60; more than 60)
7. What happened in the most recent uncertain or failed deployment? Please describe the CLI message, what you did, and the outcome.
8. What current tool, script, checklist, or practice best handles this today? What remains difficult?

## Decision Criteria

- **Proceed**: At least 4 of 6 recent deployers independently describe uncertainty about a specific run's readiness or a missed required action in the last 90 days; at least 3 provide an artifact or concrete story showing 15+ minutes of delay, rework, or coordination; and no existing practice is consistently sufficient.
- **Narrow scope**: The issue is real but concentrated in manifest-change follow-ups or in correlating overlapping notifications. Build only an explicit action-required report or run-correlation log for that case.
- **Do not build yet**: Fewer than 3 of 6 recent deployers report a concrete incident, or incidents are rare and resolved in under five minutes with existing CLI output.
- **Try existing tool/process first**: A shared release checklist, documented interpretation of CLI statuses, existing Forge logs, or a simple notification convention prevents the issue for most participants. Trial that process for 10 deployments and measure missed actions before introducing a wrapper.
