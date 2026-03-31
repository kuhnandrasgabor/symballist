---
id: TASK-065
title: Fix impact-tracking transition detection for retrieval follow-up chains
status: To Do
assignee: []
created_date: '2026-03-31 16:29'
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
- [ ] #1 Lookup/show/query/graph follow-up chains register in transitionCounts when they happen within the intended short window
- [ ] #2 The report remains privacy-safe and does not require raw query text to detect transitions
- [ ] #3 Integration coverage validates at least one lookup->show, lookup->graph, or weak-result retry transition end to end
<!-- AC:END -->
