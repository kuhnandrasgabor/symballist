---
id: TASK-056
title: Add symbol-level change awareness since last index
status: Done
assignee: []
created_date: '2026-03-31 07:41'
updated_date: '2026-03-31 07:43'
labels:
  - ux
  - retrieval
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Freshness today tells you whether indexed file metadata still matches the working tree, and changeAwareness summarizes file-level deltas. Add a first symbol-level change-awareness slice so agents can see which symbols were added, removed, or materially changed since the last index without needing full session history yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status or a new adjacent output surface reports symbol-level added/removed/changed summaries since the last index
- [x] #2 The symbol-level summary is bounded and safe for agent consumption, with counts plus representative paths or names
- [x] #3 Integration coverage proves symbol additions and removals are detected after reindexing a changed file
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a first symbol-level change-awareness slice by persisting a bounded summary of added, removed, and changed symbols from the most recent index run. The summary is accumulated during per-file reindex, surfaced in status as changeAwareness.symbolChangesSinceIndex, and kept intentionally narrow: counts plus representative path/kind/name samples instead of full symbol history.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Status now reports bounded symbol-level changes from the latest index run. Agents can see added, removed, and changed symbol counts plus representative samples alongside existing file-level freshness and change awareness, without requiring a full session-history system yet. Verified with bun test (50 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
