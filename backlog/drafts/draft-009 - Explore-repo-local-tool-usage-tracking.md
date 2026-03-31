---
id: DRAFT-009
title: Explore repo-local tool usage tracking
status: Draft
assignee: []
created_date: '2026-03-29 07:00'
labels:
  - idea
  - decision
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore whether each adopted repo should record narrow, repo-local Symballist usage metrics so we can learn which commands and helper paths agents actually use, estimate token and tool-call savings, and validate the product claim that local retrieval reduces expensive repo-navigation loops.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

Intake summary
- Capture the idea of repo-local usage tracking so symballist can learn which commands or helper paths agents actually use most in a given adopted repo.
- The main value is product feedback from real usage without depending on a separate central service or chat memory.
- A second value is cost-story support: if Symballist is mainly an agentic retrieval helper, local metrics could estimate how much retrieval payload it returned versus how much raw repo-reading/tool-calling payload it likely avoided.
- Position the feature as local, inspectable, and opt-in rather than hidden telemetry.

Related backlog items
- TASK-001 Track initial symballist vertical slice (umbrella) overlaps because this would be a follow-up to the current CLI-first retrieval slice rather than a blocker for v1.
- DRAFT-001 Decide when and how to add an agent-facing symballist query helper overlaps because helper design and usage tracking could inform each other.
- DRAFT-008 Explore diff-aware and session-aware change tracking overlaps at the level of local change/usage awareness, but that draft focuses on codebase changes rather than tool-call telemetry.

Potential conflicts
- The current adoption model emphasizes CLI-first, read-only helper usage, so adding write-time telemetry to repo-local state changes that story and should stay intentionally narrow if pursued.
- Repo-local tracking raises scope and privacy questions, including whether data should be opt-in, how long it should persist, and whether it belongs in `.symballist/` at all.
- Tracking every tool call generically may be too broad for symballist if the real need is only to understand symballist command usage.
- Query text itself may be sensitive. Default collection should avoid storing full query text unless explicitly enabled.

Promising narrow scope
- Track only Symballist commands, not generic shell/tool activity.
- Prefer opt-in local metrics stored under `.symballist/`.
- Start with simple usage events or compact summaries rather than broad telemetry infrastructure.
- Measure payload sizes and command patterns first; estimate token savings second.

Candidate metrics
- command family and command count: `status`, `lookup`, `query`, `show`, `watch`, `index`
- timestamp and optional session grouping
- result count and alternative count
- response payload size in bytes/chars as a token proxy
- whether `--compact` or `--full` was used
- whether retrieval ran in lexical or hybrid mode
- whether the repo was fresh or stale
- whether a `lookup` was followed by `show`, which helps estimate multi-step versus one-shot resolution
- truncation versus fuller-body expansion signals

Possible derived outputs
- approximate retrieval tokens returned by Symballist over time
- approximate raw-navigation tokens avoided compared with repeated grep/open/read loops
- average commands per successful inspection flow
- cumulative repo-local “estimated tokens saved” and “estimated tool calls avoided”
- top command families and most common usage patterns for product feedback

Cost-model guidance
- Keep all savings numbers explicitly labeled as estimates.
- Compare observed Symballist payload size against a conservative baseline navigation loop, such as search plus multiple file reads.
- Favor simple, honest ranges over precise but weakly justified claims.
- Treat this as support for the product story “reduce token burn and tool churn for agentic repo navigation,” not as a benchmarking substitute.

Open questions
- Is the target only symballist commands, or broader agent/tool activity inside the repo?
- Should usage be stored as simple local counters, append-only events, or summarized snapshots?
- What is the smallest useful output: top commands, command families, per-session usage, or per-repo historical trends?
- Should this be purely local introspection for the repo owner, or something that can be exported for cross-repo learning later?
- What baseline navigation model should estimated token savings compare against so the numbers stay honest and not inflated?
- Should query text be omitted entirely, stored only as length/hash, or made explicitly opt-in?
- Should usage summaries surface through `symballist status`, a dedicated metrics command, or a repo-local report file?

Recommended next action
- Keep this as a draft until the desired telemetry scope is clearer, but bias toward a small opt-in Symballist-only metrics slice that can estimate token and tool-call savings without collecting broad agent activity.
