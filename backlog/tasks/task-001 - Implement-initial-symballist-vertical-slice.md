---
id: TASK-001
title: Implement initial symballist vertical slice
status: In Progress
assignee:
  - Codex
created_date: '2026-03-28 08:56'
updated_date: '2026-03-28 14:13'
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
1. Improve query relevance with exact-name and direct-match boosting so symbols whose names closely match the query rise above generic reference hits.
2. Extend the reranking path to consider exact name matches, normalized token matches, and direct signature/body matches without breaking the existing kind-aware ranking and filtering.
3. Expand integration coverage with cases where a type definition and multiple contextual references compete for the same query.
4. Verify the live co-ma AgentConfig case to confirm direct symbol matches move closer to the top while keeping query/show stable.
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

Made the v1 README explicitly CLI-first and moved MCP out of scope for this slice.

Extended indexed symbol records and query results with line/column spans plus normalized snippets so agents get directly usable retrieval context.

Added an index metadata version so older local indexes are invalidated and rebuilt automatically when retrieval payload shape changes.

Added a CLI status command that reports repo-local index health, including paths, schema version, supported languages, and aggregate file/symbol counts.

Refined index progress output so non-interactive runs log periodic snapshots instead of every file, while TTY runs keep a width-aware in-place progress line.

Verified the new status command and repeated incremental index behavior against D:\Projects\co-ma; status reported 110 indexed files and 1769 symbols before the latest re-run, and the next index skipped 110 of 111 discovered files with clean snapshot output.

Added a show command that resolves a symbol id into the full stored record, including body, file path, language, and span metadata.

Verified the agent loop against the fixture repo: query returns ranked ids, and show returns the full symbol body for the selected id.

Normalized fallback fields in query/show output to real booleans instead of SQLite 0/1 values.

Added kind-aware query reranking so declaration-like results get a small boost over imports and file fallbacks when lexical scores are otherwise close.

Added a --kind filter to the query command and CLI parser so agents can restrict results to selected symbol kinds such as class,function.

Verified the live co-ma AgentConfig case: imports no longer dominate the default results, and --kind class,function removes import rows entirely while preserving ranked declaration/context hits.

Added exact-name and direct-match boosting on top of the existing kind-aware reranking, and widened the search candidate pool so strong symbol matches have a chance to rise above generic context hits.

Verified the boosting logic in tests, but the live co-ma AgentConfig case still appears constrained by indexing coverage rather than ranking alone; the likely true definition lives in a large file that is currently falling back instead of yielding class symbols.
<!-- SECTION:NOTES:END -->
