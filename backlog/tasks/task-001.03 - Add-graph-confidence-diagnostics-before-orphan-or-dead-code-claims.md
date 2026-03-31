---
id: TASK-001.03
title: Add graph-confidence diagnostics before orphan or dead-code claims
status: Done
assignee: []
created_date: '2026-03-31 08:04'
updated_date: '2026-03-31 08:07'
labels:
  - graph
  - retrieval
dependencies: []
parent_task_id: TASK-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement safe graph diagnostics that describe what the current index knows about a symbol without making dead-code claims. The first slice should expose explainable counts and bounded flags such as no known inbound references, only test inbound references, same-file-only connectivity, disconnected-from-indexed-graph, and root-like status where applicable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Lookup and show expose bounded graph diagnostics for the resolved symbol
- [x] #2 Query results can surface graph diagnostics for returned candidates without changing retrieval semantics
- [x] #3 The diagnostics are explicitly phrased as index-bounded signals rather than dead-code claims
- [x] #4 Integration coverage validates at least no-known-inbound, test-only inbound, and root-like or disconnected cases
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added index-bounded graph diagnostics as a safer precursor to any future orphan analysis. Resolved symbols now expose `graphDiagnostics` with explainable counts and flags including known inbound references, known outbound references, test-only inbound references, same-file-only connectivity, disconnected-from-indexed-graph, and root-like status. Query results now carry the same diagnostics for returned candidates, and query/lookup/show semantics text explicitly says these are bounded structural signals rather than dead-code claims. Integration coverage validates disconnected, test-only inbound, and root-like cases end to end.
<!-- SECTION:FINAL_SUMMARY:END -->
