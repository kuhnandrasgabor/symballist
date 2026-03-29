---
id: TASK-001
title: Track initial symballist vertical slice (umbrella)
status: In Progress
assignee:
  - Codex
created_date: '2026-03-28 08:56'
updated_date: '2026-03-28 17:01'
labels: []
dependencies: []
references:
  - TASK-002
  - TASK-003
  - TASK-004
  - TASK-005
  - TASK-006
  - TASK-007
  - TASK-008
  - TASK-009
  - DRAFT-002
  - DRAFT-005
  - DRAFT-006
  - DRAFT-007
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track the initial symballist vertical slice as an umbrella task. This is no longer the place for detailed implementation history; it is the high-level view of what the first usable CLI-first retrieval slice includes, what areas are already complete, and what near-term polish remains before the slice feels truly dependable in daily agent use.

Current v1 shape:
- CLI-first local retrieval for agents
- repo-local state in .symballist/
- Python, HTML, and Markdown indexing
- lexical symbol/doc retrieval with explicit fallbacks
- freshness-aware status/query/show loop
- lightweight structural relations and related-symbol expansion
- downstream agent adoption bootstrap during init
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
1. Keep TASK-001 as the umbrella/epic for the initial vertical slice rather than a detailed execution log.
2. Treat completed slice work as closed subtasks: TASK-002 through TASK-009.
3. Use new tasks for concrete implementation work and drafts for follow-up ideas/polish discovered during dogfooding.
4. Near-term likely follow-ups from live use: freshness consistency, implementation-first ranking, invocation polish, and query/show ergonomics.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Vertical slice status by area

Foundation
- Done: init, index, status, query, and show commands form a full CLI-first loop.
- Done: explicit --root targeting supports cross-repo use.

Indexing and storage
- Done: SQLite + FTS local index.
- Done: incremental reindexing for changed files.
- Done: Python and HTML symbol extraction with file-level fallback.
- Done: large-file Python top-level recovery.
- Done: Markdown heading indexing with file-level fallback.

Retrieval quality and context
- Done: rich query results include spans and snippets.
- Done: kind-aware and direct-match reranking.
- Done: stale-index detection surfaces freshness in status/query/show.
- Done: show returns full symbol bodies plus lightweight relations and related symbols.

Adoption and workflow
- Done: downstream adoption workflow docs and reusable snippets.
- Done: init bootstraps local .symballist/instructions assets and managed AGENTS.md / CLAUDE.md symballist retrieval blocks.
- Done: real dogfooding in co-ma confirms the tool is already useful for discovery and orientation.

Known polish areas from live feedback
- Draft: DRAFT-005 freshness consistency immediately after indexing.
- Draft: DRAFT-002 implementation-first ranking for conceptual queries.
- Draft: DRAFT-007 Windows invocation UX and a real symballist command.
- Draft: DRAFT-006 query/show ergonomics for daily use.
- Later drafts: DRAFT-003, DRAFT-004, DRAFT-008, DRAFT-009.

Completed subtasks
- TASK-002 large-file Python symbol recovery.
- TASK-003 stale-index detection.
- TASK-004 lightweight import relations.
- TASK-005 relation-aware retrieval context.
- TASK-006 lightweight Markdown indexing.
- TASK-007 agent adoption workflow docs.
- TASK-008 downstream instruction snippets.
- TASK-009 init-time downstream instruction bootstrap.
<!-- SECTION:NOTES:END -->
