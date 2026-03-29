---
id: TASK-001
title: Track initial symballist vertical slice (umbrella)
status: In Progress
assignee:
  - Codex
created_date: '2026-03-28 08:56'
updated_date: '2026-03-28 17:40'
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
  - TASK-010
  - TASK-011
  - TASK-012
  - TASK-013
  - TASK-014
  - TASK-015
  - DRAFT-003
  - DRAFT-004
  - DRAFT-008
  - DRAFT-009
  - DRAFT-010
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
2. Treat completed slice work as closed subtasks: TASK-002 through TASK-012.
3. Use drafts for follow-up polish and next-slice ideas discovered during dogfooding.
4. Near-term priority order from latest feedback: DRAFT-004, DRAFT-003.
5. Medium-term follow-ups: DRAFT-009, DRAFT-010, DRAFT-008, then broader helper-integration questions in DRAFT-001.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Vertical slice status by area

Foundation
- Done: init, index, status, query, and show commands form a full CLI-first loop.
- Done: explicit --root targeting supports cross-repo use.
- Done: a real symballist command and local wrappers reduce downstream Windows friction.

Indexing and storage
- Done: SQLite + FTS local index.
- Done: incremental reindexing for changed files.
- Done: Python and HTML symbol extraction with file-level fallback.
- Done: large-file Python top-level recovery.
- Done: Markdown heading indexing with file-level fallback.

Retrieval quality and context
- Done: rich query results include spans and snippets.
- Done: kind-aware, direct-match, and implementation-first reranking.
- Done: stale-index detection surfaces freshness in status/query/show.
- Done: freshness checks now ignore tiny mtime jitter immediately after indexing.
- Done: symbol-shaped queries now prefer exact owning definitions over normalized references.
- Done: query defaults are tighter, and show supports exact-name lookup without requiring an intermediate id.
- Done: show returns full symbol bodies plus lightweight relations and related symbols.

Adoption and workflow
- Done: downstream adoption workflow docs and reusable snippets.
- Done: init bootstraps local .symballist/instructions assets, wrapper commands, and managed AGENTS.md / CLAUDE.md symballist retrieval blocks.
- Done: real dogfooding in co-ma confirms the tool is now genuinely useful for day-to-day discovery, especially for implementation-oriented queries.

Priority order from latest live feedback
- Done: TASK-013 fixed query CLI flag parsing and help handling, including query subcommand help and `--top` alias support.
- Done: TASK-014 improved exact-definition ranking for symbol-shaped queries such as `DistillationEngine`.
- Done: TASK-015 improved query/show ergonomics with tighter default result counts and `show --name`.
- Now: DRAFT-004 clarify retrieval confidence, score semantics, and trust signals.
- Next: DRAFT-003 add query intent filters for implementation, docs, and tests.
- Later: DRAFT-009 strengthen semantic matching for concept-oriented queries.
- Later: DRAFT-010 ensure init adds .symballist to .gitignore by default.
- Later: DRAFT-008 explore diff-aware and session-aware change tracking.
- Later: DRAFT-001 decide when and how to add an agent-facing symballist query helper.

Completed subtasks
- TASK-002 large-file Python symbol recovery.
- TASK-003 stale-index detection.
- TASK-004 lightweight import relations.
- TASK-005 relation-aware retrieval context.
- TASK-006 lightweight Markdown indexing.
- TASK-007 agent adoption workflow docs.
- TASK-008 downstream instruction snippets.
- TASK-009 init-time downstream instruction bootstrap.
- TASK-010 freshness consistency immediately after indexing.
- TASK-011 implementation-first ranking for conceptual queries.
- TASK-012 Windows invocation UX and a real symballist command.
- TASK-013 query CLI flag parsing and help handling.
- TASK-014 exact-symbol definition-first ranking.
- TASK-015 query/show ergonomics for daily use.
<!-- SECTION:NOTES:END -->
