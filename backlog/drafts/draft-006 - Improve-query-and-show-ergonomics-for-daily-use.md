---
id: DRAFT-006
title: Improve query and show ergonomics for daily use
status: Draft
assignee: []
created_date: '2026-03-28 16:46'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agent feedback says the current flow is usable, but a few CLI ergonomics still add friction. In particular, show requires a numeric id from a previous query, and longer query outputs can include useful top hits plus noisy tail results. Suggested ideas included a lower default top-N, a --top or similar control, a relevance cutoff, and alternate lookup forms such as show --name or path-based lookup.

Capture this as a daily-UX draft rather than a ranking-only draft. The emphasis is on making the common query -> inspect loop feel lighter without changing the underlying retrieval model first.

User value:
- less friction when moving from discovery to inspection
- less noise in result lists
- easier use when the agent already knows a likely symbol name or location

Observed motivation:
- one agent wanted show --name or show path:line style alternatives
- one agent explicitly called out top-N noise at the bottom of query results
- both agents already like status -> query -> show, so this draft should improve that loop rather than replace it
<!-- SECTION:DESCRIPTION:END -->
