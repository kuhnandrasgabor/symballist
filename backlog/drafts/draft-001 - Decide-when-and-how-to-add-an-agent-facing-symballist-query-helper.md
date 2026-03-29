---
id: DRAFT-001
title: Decide when and how to add an agent-facing symballist query helper
status: Draft
assignee: []
created_date: '2026-03-28 14:40'
updated_date: '2026-03-28 14:42'
labels:
  - idea
  - decision
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore a lightweight agent-oriented helper or skill that makes common symballist query/show flows easy to reuse, so agents can pull structured retrieval context in a neat, low-friction way without depending on ad hoc copy-paste patterns.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Intake summary
- Capture the idea of a copy-paste-friendly agent helper or skill for symballist so agents in this project can use query/show in a neat, repeatable way.
- The main question is timing as much as feature shape: add it soon for ergonomics, or wait until the retrieval surface is a bit more settled.

Related backlog items
- TASK-001 Implement initial symballist vertical slice overlaps because it established the current query/show loop, result payloads, and agent-oriented retrieval behavior.
- TASK-004 Add lightweight import relations overlaps because richer retrieval context changes what the ideal helper should fetch or present; this task is now marked Done.

Potential conflicts
- A helper added too early could lock us into a brittle prompt or copy-paste workflow while query output and relation context are still evolving.
- If MCP becomes the preferred agent integration path soon, a CLI-specific helper may need to stay intentionally narrow or transitional.

Open questions
- Is the first slice just project guidance for agents, or a real reusable helper command/skill with opinionated query/show sequences?
- Should the helper target CLI-only usage first, or should it wait until the MCP shape is clearer?
- What counts as success: fewer agent retries, better first-query habits, more consistent result formatting, or easier copy-forward into the next prompt?

Recommended next action
- Keep this as a draft and revisit after the current retrieval surface is stable enough to design a helper around durable primitives rather than a moving target.
<!-- SECTION:NOTES:END -->
