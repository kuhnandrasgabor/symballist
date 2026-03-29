---
id: DRAFT-001
title: Implement initial symballist vertical slice
status: Draft
assignee: []
created_date: '2026-03-28 08:56'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the first useful end-to-end slice for symballist as an agent-first code retrieval tool. This slice should establish repo-local state, index a small set of supported source files, store symbol/search data locally, and return structured query results without requiring the full long-term architecture to be complete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The project can initialize repo-local symballist state in the target repository.
- [ ] #2 The indexer can scan Python and HTML files and persist symbol-oriented records with a file-level fallback when parsing fails.
- [ ] #3 A query command returns ranked results from local index data using lexical search, with room for optional embedding augmentation later.
- [ ] #4 The implementation is structured so MCP exposure and incremental reindexing can be added without replacing the core storage and indexing model.
<!-- AC:END -->
