---
id: TASK-001.04
title: Add advisory possible-orphan signals from graph connectivity
status: Done
assignee: []
created_date: '2026-03-31 08:12'
updated_date: '2026-03-31 08:12'
labels:
  - graph
  - retrieval
dependencies: []
parent_task_id: TASK-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a cautious first slice of the dead-code-connectivity idea as advisory possible-orphan signals rather than authoritative dead-code detection. Use the new graph diagnostics and root-awareness layers to surface bounded cleanup candidates in status and on returned symbols/results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Returned symbols/results can surface possible-orphan candidacy as part of graph diagnostics
- [x] #2 Status exposes a bounded list of advisory possible-orphan candidates
- [x] #3 The feature is explicitly framed as index-bounded and not a dead-code claim
- [x] #4 Integration coverage validates the advisory possible-orphan behavior end to end
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an advisory possible-orphan slice on top of the new graph diagnostics. Returned symbols and query results now expose `possibleOrphanCandidate` and `possibleOrphanReasons` inside `graphDiagnostics`, and status now exposes `graphAwareness.possibleOrphans` as a bounded list of cleanup candidates. The feature is intentionally conservative: it is derived from no-known-inbound-reference and non-root-like signals, documented as index-bounded, and never presented as authoritative dead-code detection. Integration coverage validates status, lookup, show, and query behavior end to end.
<!-- SECTION:FINAL_SUMMARY:END -->
