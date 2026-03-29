---
id: TASK-034
title: Add graph-aware reranking using one-hop candidate agreement
status: Done
assignee: []
created_date: '2026-03-29 16:45'
updated_date: '2026-03-29 16:45'
labels:
  - feature
  - spike
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the first graph-aware retrieval slice from the staged roadmap. Use existing one-hop structure inside the current candidate set to influence ranking, with bounded signals such as same-file clustering and import-linked neighbors. Keep the change inside the current SQLite model and make the effect visible in query output so graph-aware behavior is explainable.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the first graph-aware retrieval slice inside the existing candidate reranking path. Added bounded one-hop graph signals from same-file clustering and import-linked neighbors, exposed them as graphSignals in query/lookup results, and used them to rerank ambiguous candidate neighborhoods without introducing a separate graph store or recursive traversal. Added regression coverage and verified the behavior in a live co-ma query.
<!-- SECTION:FINAL_SUMMARY:END -->
