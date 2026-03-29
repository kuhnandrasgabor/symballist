---
id: DRAFT-005
title: Harden freshness consistency immediately after indexing
status: Draft
assignee: []
created_date: '2026-03-28 16:46'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Live use exposed a trust issue where a query immediately after indexing reported stale once, while the next status check showed fresh. Even if this was a timing edge case, it weakens confidence in the freshness model because agents need the status/index/query loop to feel deterministic.

Capture a draft focused specifically on post-index freshness consistency. The goal is not broader background indexing or daemon work yet; it is to make sure that once index completes, subsequent status/query/show calls reflect the new state reliably unless a real file change occurred.

User value:
- removes an avoidable source of distrust in the core retrieval loop
- makes status -> index -> query feel safe and deterministic
- helps agent instructions stay simple because the freshness rule actually holds in practice

Observed motivation:
- one agent saw stale on the first query after indexing, then healthy freshness immediately afterward
- both agents specifically praised freshness checks, so this is worth hardening
<!-- SECTION:DESCRIPTION:END -->
