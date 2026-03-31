---
id: TASK-001.02
title: Add entrypoint and root awareness for graph interpretation
status: Done
assignee: []
created_date: '2026-03-31 07:59'
updated_date: '2026-03-31 08:02'
labels:
  - graph
  - retrieval
dependencies: []
parent_task_id: TASK-001
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a first lightweight root-awareness layer so likely entrypoints and startup files are visible to users and can participate in graph interpretation. Keep the scope bounded to explainable path-based heuristics and light retrieval signals rather than framework-specific magic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status surfaces a bounded summary of likely graph roots or entrypoints in the indexed repo
- [x] #2 Query or lookup can expose a root-aware graph signal for matching candidates when appropriate
- [x] #3 The first slice uses conservative, explainable heuristics rather than deep framework inference
- [x] #4 Integration coverage exercises both the status view and retrieval-facing root awareness
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a first lightweight root-awareness layer for graph interpretation. Status now exposes `graphAwareness.likelyRoots` with conservative, explainable path-based heuristics for likely startup or entrypoint files. Query and lookup can now emit a `root_candidate` graph signal for startup-oriented searches so likely roots are not treated as anonymous disconnected files. The slice stays intentionally bounded: no framework-specific hook inference, only path and top-level symbol hints. Integration coverage validates both the status surface and retrieval-facing signal, and user-facing docs now mention the new fields.
<!-- SECTION:FINAL_SUMMARY:END -->
