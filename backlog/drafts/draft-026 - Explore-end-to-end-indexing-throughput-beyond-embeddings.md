---
id: DRAFT-026
title: Explore end-to-end indexing throughput beyond embeddings
status: Draft
assignee: []
created_date: '2026-04-01 05:27'
labels:
  - idea
  - spike
  - decision
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request: even when most files are skipped, indexing large repos still spends minutes walking roughly 12k files before any meaningful work happens. Explore how to reduce total index and freshness-check wall time, not just Ollama embedding time.

Current code context: `src/fs.ts:listSourceFiles` recursively walks the tree with awaited `readdir` and per-file language detection, then sorts the full result set before returning. `src/commands/index.ts` depends on that full scan up front, and `src/freshness.ts` also calls `listSourceFiles`, so large repos pay broad traversal costs even when incremental skip logic avoids re-indexing most files.

Investigation areas:
- Speed up repo traversal and language detection for large trees.
- Avoid full upfront scans when only freshness deltas are needed.
- Reuse watch-state, cached manifests, or git-aware file listings when that is cheaper than recursive filesystem walking.
- Measure whether metadata calls, directory walking, sorting, or per-file language detection dominate the wall time.
- Consider separate fast paths for status/freshness versus full index rebuilds.

Tradeoffs to evaluate:
- Complexity and cache invalidation risk from persisted file manifests.
- Whether git-based shortcuts break non-git repos or ignored-but-useful files.
- Accuracy implications if faster scans miss extensionless or generated-but-supported files.
- Whether traversal concurrency helps enough to justify higher I/O pressure.

Recommended next action: benchmark traversal, freshness, and incremental-index phases separately on a large repo, then compare one no-cache optimization path and one cached-manifest or git-assisted path.
<!-- SECTION:DESCRIPTION:END -->
