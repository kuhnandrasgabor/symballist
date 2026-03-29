---
id: TASK-026
title: Decide when and how to add an agent-facing symballist query helper
status: Done
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

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Symballist exposes a narrow agent-facing helper command for the common query/show flow.
- [x] #2 The helper stays CLI-first and reuses the existing retrieval primitives instead of introducing a parallel ranking path.
- [x] #3 The helper returns both the selected top result and enough follow-up context to reduce manual query/show chaining.
- [x] #4 Regression coverage proves the helper command and CLI parsing behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as a narrow CLI-first helper:

- added `symballist lookup "<text>"`
- it reuses the existing query semantics, selects the top hit, resolves that symbol, and returns full context plus alternatives in one payload
- it supports the same query-intent flags as `query`, plus `--full` for expanded bodies

Why this shape:

- keeps the helper thin and durable
- avoids a separate retrieval path
- gives agents a copy-forward-friendly payload without forcing a new skill system or MCP dependency

Verification:

- `bun test` passes with 30 tests
- added regression coverage for the bundled lookup flow and `lookup --help`
<!-- SECTION:NOTES:END -->
<!-- SECTION:NOTES:END -->
