---
id: TASK-010
title: Harden freshness consistency immediately after indexing
status: Done
assignee: []
created_date: '2026-03-28 16:46'
updated_date: '2026-03-28 17:06'
labels: []
dependencies: []
priority: high
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

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Freshness checks do not report stale solely because of tiny file mtime jitter immediately after indexing.
- [x] #2 Real source changes still produce stale freshness results.
- [x] #3 Regression coverage exists for the immediate post-index jitter case.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a small mtime comparison tolerance in detectIndexFreshness so status/query/show no longer require exact floating-point mtime equality after indexing.

Added regression coverage that simulates tiny post-index mtime drift and confirms freshness stays healthy, while the existing stale-after-change test continues to pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened the first freshness consistency edge case by ignoring tiny mtime jitter immediately after indexing. Verified with bun test: 12 tests passing, including the new freshness jitter regression.
<!-- SECTION:FINAL_SUMMARY:END -->
