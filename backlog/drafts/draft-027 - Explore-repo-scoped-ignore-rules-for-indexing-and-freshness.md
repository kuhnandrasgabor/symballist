---
id: DRAFT-027
title: Explore repo-scoped ignore rules for indexing and freshness
status: Draft
assignee: []
created_date: '2026-04-01 05:27'
labels:
  - idea
  - spike
  - decision
  - indexing
  - freshness
  - global
  - large-repo
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request: allow repos to exclude directories or files from indexing and search, especially generated code, binaries, vendor zones, or other noisy areas. This could follow `.gitignore`, use a repo-local `.symballist` ignore file, or support both with clear precedence.

Current code context: query and lookup already support retrieval-time `--exclude-path` filtering, but `src/fs.ts:listSourceFiles` still traverses and considers the whole supported tree, and `src/freshness.ts` uses the same scan for stale detection. There is currently no persistent index-time ignore layer for search scope.

Decisions to compare:
- Honor `.gitignore` by default, optionally with an override for ignored-but-important source files.
- Add a dedicated repo-local ignore file under `.symballist/` for index and freshness scope control.
- Support both `.gitignore` and `.symballist` ignore rules with explicit merge and precedence semantics.
- Decide whether ignored paths should be excluded only from indexing or also from freshness reporting and query surfaces.

Tradeoffs to evaluate:
- User surprise if `.gitignore` hides source files they still expect to search.
- Portability and documentation burden of a new ignore format.
- Need for reindex/rebuild behavior when ignore rules change.
- Interaction with existing retrieval-time `--exclude-path` flags, which solve a different problem.

Recommended next action: define desired semantics first, then prototype a repo-local ignore file path because it is easier to document and control than implicit `.gitignore` behavior; compare that against optional `.gitignore` adoption before promotion.
<!-- SECTION:DESCRIPTION:END -->
