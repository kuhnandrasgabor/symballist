---
id: TASK-028
title: Add optional local embeddings and hybrid retrieval
status: Done
assignee: []
created_date: '2026-03-29 09:12'
updated_date: '2026-03-29 15:19'
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented optional local embeddings and hybrid retrieval with an Ollama-first adapter and repo-local config in .symballist/config.json. Index now generates symbol embeddings when enabled, query/lookup automatically blend lexical and semantic candidates when vectors are available for the active provider/model, status reports embeddings availability, and init now preserves repo-local config instead of overwriting it. Verification: bun test (33 pass), bun run src/cli.ts status --root D:\Projects\symballist, plus mocked hybrid retrieval coverage proving semantic-only matches can surface via query.
<!-- SECTION:FINAL_SUMMARY:END -->
