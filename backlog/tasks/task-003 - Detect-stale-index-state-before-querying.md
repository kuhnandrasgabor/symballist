---
id: TASK-003
title: Detect stale index state before querying
status: Done
assignee:
  - '@Codex'
created_date: '2026-03-28 14:20'
updated_date: '2026-03-28 14:33'
labels:
  - spike
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Detect and report when the local index is likely stale relative to current source-file metadata, so agents can see when query results may lag behind active repository changes. This work should stay lightweight and CLI-first: compare indexed file metadata against the current filesystem, expose the result in status, and surface a soft warning in retrieval commands without introducing a background daemon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status reports whether the index is stale and includes counts for changed, new, and deleted source files.
- [x] #2 Query and show include a lightweight freshness summary without breaking the core result payload.
- [x] #3 A repo that changes after indexing is detected as stale in integration coverage.
- [x] #4 Fresh repos and repeated index runs still report cleanly with existing tests preserved.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Mark TASK-003 In Progress and add a shared freshness check that compares indexed file metadata against the current source tree to detect changed, new, and deleted files.
2. Extend the status command to report stale-index state, including a simple boolean plus counts for changed/new/deleted files.
3. Surface the same freshness summary as a soft warning block in query and show output so agents can see when retrieval may be stale.
4. Add integration coverage for stale status and stale query output, then verify the behavior with a live repo after the tests pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a shared freshness detector that compares current source-file metadata against the indexed file table to detect changed, new, and deleted files.

Extended status, query, and show output with an indexFreshness block so agents can see when retrieval results may be stale.

Verified the live co-ma repo reports a stale index when files change after indexing; the freshness block currently shows one changed file.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented lightweight stale-index detection by comparing the indexed file table against current source-file metadata. Status now reports stale state plus changed/new/deleted counts, and query/show include the same freshness block as a soft warning without altering the core result objects. Validation included automated coverage for fresh and stale repos plus a live co-ma check, which correctly reported one changed file after indexing and surfaced the stale warning alongside AgentConfig retrieval.
<!-- SECTION:FINAL_SUMMARY:END -->
