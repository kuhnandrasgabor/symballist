---
id: TASK-011
title: Improve implementation-first ranking for conceptual queries
status: Done
assignee: []
created_date: '2026-03-28 16:46'
updated_date: '2026-03-28 17:15'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agent feedback from live co-ma use says symballist is strong for targeted symbol lookups but weaker for conceptual queries such as memory store or distiller. The common failure mode is that tests, docs, or lower-signal references can outrank the main implementation a coding agent usually wants first.

Capture this as a ranking-quality draft focused on default ordering for broad code queries. The likely direction is to bias implementation paths like src/ ahead of tests/ and broad docs when the query intent appears code-oriented, while preserving the ability to discover docs when docs are the real target.

User value:
- make first-pass results feel trustworthy for day-to-day coding questions
- reduce the need to mentally filter out tests and incidental references
- improve confidence that top hits are likely the main implementation entry points

Observed examples:
- memory store leaned too heavily toward tests
- distiller did not immediately surface the main implementation symbol near the top
- AgentConfig worked well once the real definition existed in the index, which is the target quality bar
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Broad code-oriented queries prefer implementation-shaped src results over tests in regression coverage.
- [x] #2 Doc-oriented queries such as architecture still prefer Markdown documentation in regression coverage.
- [x] #3 Live co-ma checks show broad conceptual queries no longer lead primarily with import noise.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a lightweight code-oriented path bias in reranking so src/ results are favored over tests/ for broad code queries, while doc-oriented terms like backlog, workflow, and architecture keep their documentation bias.

Expanded FTS query construction to include a concatenated normalized token for multi-word queries, so phrases like memory store can also match symbols like MemoryStore and reach the reranker.

Added regression coverage proving memory store prefers src over tests and architecture still prefers Markdown docs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a first implementation-first ranking pass for conceptual queries by combining path-aware reranking with slightly stronger lexical recall for multi-word symbol-like phrases. Verified with bun test and live co-ma checks for memory store and distiller.
<!-- SECTION:FINAL_SUMMARY:END -->
