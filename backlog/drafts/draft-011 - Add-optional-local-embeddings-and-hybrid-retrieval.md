---
id: DRAFT-011
title: Add optional local embeddings and hybrid retrieval
status: Draft
assignee: []
created_date: '2026-03-29 09:12'
labels:
  - idea
  - spike
  - decision
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore the next major retrieval-quality step: optional local embeddings plus hybrid lexical and semantic ranking, while preserving the current lexical-first fallback path when embeddings are unavailable or stale.

User value:
- improves concept and fuzzy-intent retrieval far beyond lexical matching alone
- raises the ceiling for agent queries that do not use exact symbol names
- preserves reliability because lexical search remains the non-optional base layer

Expected lift:
- likely the biggest remaining retrieval-quality lift
- medium implementation cost with meaningful model/storage/invalidation decisions
- highest value after operational freshness is easier to maintain
<!-- SECTION:DESCRIPTION:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->
Recommended first slice:

- local embedding generation for indexed units
- optional vector storage in repo-local state
- hybrid ranking that fuses lexical rank with semantic similarity
- explicit degradation when embeddings are missing, stale, or disabled

Important design constraints:

- keep embeddings optional
- keep repo-local and CLI-first
- avoid making query correctness depend on a model being installed
- define clear invalidation/rebuild rules when files change

Why this fits after automatic refresh:

- embeddings help most when the index is already kept fresh with low friction
- hybrid retrieval is the clearest path from “good lexical retriever” to “strong conceptual retriever”
<!-- SECTION:NOTES:END -->
