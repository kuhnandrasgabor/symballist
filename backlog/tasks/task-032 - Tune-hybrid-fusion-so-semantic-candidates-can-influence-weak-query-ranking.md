---
id: TASK-032
title: Tune hybrid fusion so semantic candidates can influence weak-query ranking
status: Done
assignee: []
created_date: '2026-03-29 16:21'
updated_date: '2026-03-29 16:25'
labels:
  - spike
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback and live diagnostics show that hybrid retrieval is now observable, but semantic candidates often fail to survive final ranking because lexical BM25 distances dominate the merged score space. Tune the fusion layer so embeddings materially influence ranking when lexical signal is weak, while preserving strong exact and implementation-oriented lexical wins.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reworked hybrid fusion to use source-rank-based scoring instead of directly mixing BM25 distances with cosine similarity. Semantic candidates can now survive weak-query ranking when they are genuinely relevant, while exact and strong lexical wins remain stable. Added regression coverage for semantic promotion over lexical doc noise; bun test passes with 38 tests.
<!-- SECTION:FINAL_SUMMARY:END -->
