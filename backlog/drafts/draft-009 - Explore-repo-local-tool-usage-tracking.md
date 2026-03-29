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
Explore whether each adopted repo should record the amount and kinds of tool calls it receives in repo-local symballist state, so we can learn which commands and helper paths are actually used most during real agent work.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

Intake summary
- Capture the idea of repo-local usage tracking so symballist can learn which commands or helper paths agents actually use most in a given adopted repo.
- The main value is product feedback from real usage without depending on a separate central service or chat memory.

Related backlog items
- TASK-001 Track initial symballist vertical slice (umbrella) overlaps because this would be a follow-up to the current CLI-first retrieval slice rather than a blocker for v1.
- DRAFT-001 Decide when and how to add an agent-facing symballist query helper overlaps because helper design and usage tracking could inform each other.
- DRAFT-008 Explore diff-aware and session-aware change tracking overlaps at the level of local change/usage awareness, but that draft focuses on codebase changes rather than tool-call telemetry.

Potential conflicts
- The current adoption model emphasizes CLI-first, read-only helper usage, so adding write-time telemetry to repo-local state changes that story and should stay intentionally narrow if pursued.
- Repo-local tracking raises scope and privacy questions, including whether data should be opt-in, how long it should persist, and whether it belongs in `.symballist/` at all.
- Tracking every tool call generically may be too broad for symballist if the real need is only to understand symballist command usage.

Open questions
- Is the target only symballist commands, or broader agent/tool activity inside the repo?
- Should usage be stored as simple local counters, append-only events, or summarized snapshots?
- What is the smallest useful output: top commands, command families, per-session usage, or per-repo historical trends?
- Should this be purely local introspection for the repo owner, or something that can be exported for cross-repo learning later?

Recommended next action
- Keep this as a draft until the desired telemetry scope is clearer, then decide whether it belongs as a small local usage feature for symballist itself or as a broader agent-workflow instrumentation idea outside the current retrieval slice.
