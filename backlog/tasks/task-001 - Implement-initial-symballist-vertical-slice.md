---
id: TASK-001
title: Implement initial symballist vertical slice
status: In Progress
assignee:
  - Codex
created_date: '2026-03-28 08:56'
updated_date: '2026-03-28 10:04'
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
- [x] #1 The project can initialize repo-local symballist state in the target repository.
- [x] #2 The indexer can scan Python and HTML files and persist symbol-oriented records with a file-level fallback when parsing fails.
- [x] #3 A query command returns ranked results from local index data using lexical search, with room for optional embedding augmentation later.
- [x] #4 The implementation is structured so MCP exposure and incremental reindexing can be added without replacing the core storage and indexing model.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add progress reporting to the indexing command so long-running repo scans surface file and symbol counts while they run.
2. Extend the SQLite-backed file metadata model to support incremental indexing decisions based on file size and modification time.
3. Skip unchanged files during index runs while still re-indexing changed files and removing stale symbol rows for files that are updated.
4. Expand integration coverage to prove repeated index runs avoid unnecessary work and still return correct query results.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scaffolded a zero-dependency Bun + TypeScript CLI slice with init, index, and query commands.

Added SQLite-backed storage, Python and HTML symbol extraction, and file-level fallback records.

Added fixture-based integration tests covering init, index, and lexical query.

Upgraded Python and HTML extraction to tree-sitter-backed parsing using compatible parser package versions for Windows/Bun.

Added CLI support for --root so symballist can target another repository without changing directories.

Verified the upgraded slice with bun test and manual explicit-root queries against the fixture repo.

Dogfooding against D:\\Projects\\co-ma surfaced a walker issue: unreadable temp/cache directories should be skipped instead of aborting indexing.

Initialized .symballist in D:\\Projects\\co-ma and confirmed explicit-root manual queries work on the fixture repo.

A full co-ma index run remains blocked in this sandboxed session by outside-workspace write constraints after initialization, so the next real validation step should be run from a normal local shell.

Adjusted init to stop eagerly creating index.db and improved readonly SQLite errors with a clearer recovery message for cross-repo dogfooding.

Hardened tree-sitter extraction so large or parser-hostile files fall back to file-level records instead of aborting indexing; co-ma core.py exceeds the safe parser limit on this runtime.

Added a root .gitignore covering node_modules, repo-local .symballist state, local agent tool folders, and scratch artifacts before the next commit.
<!-- SECTION:NOTES:END -->
