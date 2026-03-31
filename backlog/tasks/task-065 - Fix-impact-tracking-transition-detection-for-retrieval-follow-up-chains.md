---
id: TASK-065
title: Fix impact-tracking transition detection for retrieval follow-up chains
status: Done
assignee: []
created_date: '2026-03-31 16:29'
updated_date: '2026-03-31 16:40'
labels:
  - bug
  - metrics
  - feedback
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing validated the new repo-local impact report overall, but short-window transition counts stayed at zero despite real lookup -> graph -> show -> full show usage. Investigate why follow-up chain detection is not firing and make the transition summary reflect real retrieval navigation sequences.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Lookup/show/query/graph follow-up chains register in transitionCounts when they happen within the intended short window
- [x] #2 The report remains privacy-safe and does not require raw query text to detect transitions
- [x] #3 Integration coverage validates at least one lookup->show, lookup->graph, or weak-result retry transition end to end
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed impact-tracking transition detection by storing the last retrieval/navigation flow event separately from generic command history. This keeps lookup/query/show/graph chains detectable even when `status`, `watch`, or `report` calls are interleaved between them.

Added integration coverage for interleaved non-flow commands and verified the privacy boundary stayed intact because the fix still relies only on command/outcome metadata, not raw query text. Verified with `bun test tests/integration.test.ts`.
<!-- SECTION:FINAL_SUMMARY:END -->
