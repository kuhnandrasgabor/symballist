---
id: DRAFT-002
title: Improve implementation-first ranking for conceptual queries
status: Draft
assignee: []
created_date: '2026-03-28 16:46'
labels: []
dependencies: []
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
