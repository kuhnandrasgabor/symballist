---
id: DRAFT-034
title: Explore decoupling embedding storage from index rebuilds
status: Draft
assignee: []
created_date: '2026-04-01 13:20'
labels:
  - idea
  - spike
  - decision
  - embeddings
  - indexing
  - performance
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request: evaluate whether embeddings should be stored separately from the current repo-local index database so expensive embedding generation can survive index invalidation and rebuilds.

Current code context: embeddings already live in a separate table (`symbol_embeddings`) but inside the same `index.db`, and `clearIndexData()` removes them during rebuilds together with symbols, relations, FTS, and file metadata. Rebuild-triggered invalidation is currently tied to the symbol-row lifecycle, so preserving embeddings would require a more stable key than the transient `symbol_id`, or a separate storage boundary plus a remapping strategy.

Main question: when index compatibility changes, which parts of the stored state actually need invalidation? If extractor/storage changes alter symbol boundaries, bodies, names, or spans, reusing old embeddings by `symbol_id` is unsafe. A viable design likely needs content-addressed or fingerprint-keyed embeddings, plus rules for when an embedding can be reused versus regenerated.

Tradeoffs to evaluate:
- Whether a separate SQLite file or table split is enough, versus needing logical decoupling keyed by content hashes or stable symbol fingerprints.
- Risk of stale semantic matches when extractor changes alter symbol identity or text content.
- Complexity of remapping preserved embeddings onto rebuilt symbols.
- Disk growth, garbage collection, and multi-model/provider storage behavior.
- Whether the real bottleneck is rebuild invalidation or embedding throughput, since DRAFT-025 already explores faster generation.

Recommended next action: spike the reuse model first. Compare three options: keep current behavior, split embeddings into separate storage with fingerprint-based reuse, or add an optional embedding cache keyed by provider/model plus normalized symbol content while leaving `index.db` authoritative for active symbol linkage.
<!-- SECTION:DESCRIPTION:END -->
