---
id: TASK-001.01
title: Add lightweight usage relations beyond imports and containment
status: Done
assignee: []
created_date: '2026-03-31 07:52'
updated_date: '2026-03-31 07:57'
labels:
  - graph
  - retrieval
dependencies: []
parent_task_id: TASK-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a conservative first slice of usage-style graph relations so retrieval and related-symbol expansion can benefit from more than imports and containment. Keep the scope narrow and low-noise: Python-first, bounded, and explicitly not a full call graph.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Python indexing records at least one new low-noise usage relation type beyond imports and contained_in
- [x] #2 Show/lookup related-symbol flows can surface the new relation type
- [x] #3 Graph-aware retrieval can benefit from the new relation without regressing existing import behavior
- [x] #4 Integration coverage exercises the new relation end to end
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a first lightweight usage relation slice with a new `uses` edge extracted from conservative Python call sites. Python indexing now resolves same-file and imported call targets where symbol resolution is unambiguous, stores those relations alongside existing import edges, and exposes them in show/lookup related-symbol flows. Graph-aware reranking now gives lighter support to usage-connected candidate neighborhoods without displacing existing import-based support. Integration coverage proves relation extraction, related-symbol surfacing, and retrieval support end to end.
<!-- SECTION:FINAL_SUMMARY:END -->
