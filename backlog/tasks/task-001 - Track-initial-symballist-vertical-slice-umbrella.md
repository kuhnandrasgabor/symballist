---
id: TASK-001
title: Track initial symballist vertical slice (umbrella)
status: In Progress
assignee:
  - Codex
created_date: '2026-03-28 08:56'
updated_date: '2026-03-29 09:20'
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
  - TASK-016
  - TASK-017
  - TASK-018
  - TASK-019
  - TASK-020
  - TASK-021
  - TASK-022
  - TASK-023
  - TASK-024
  - TASK-025
  - TASK-026
  - DRAFT-008
  - DRAFT-010
  - DRAFT-011
  - DRAFT-012
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
2. Treat completed slice work as closed subtasks: TASK-002 through TASK-026.
3. Use drafts for follow-up polish and next-slice ideas discovered during dogfooding.
4. Near-term roadmap after the vertical slice: DRAFT-010, then DRAFT-011, then DRAFT-012.
5. Exploratory follow-up beyond that: DRAFT-008.
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
- Done: query/show output now expose distance, confidence, matchReason, extraction, and trustLevel semantics.
- Done: query supports explicit code-only, docs-only, test-excluding, and implementation-preferring intent controls.
- Done: concept-oriented queries now supplement lexical hits with source-path candidates so canonical implementations surface more reliably.
- Done: query-time trust now combines extraction quality with match strength, and generic lexical leftovers surface as `token_overlap` instead of misleading `body_text`.
- Done: `--prefer-implementation` now acts as a real code-oriented intent, suppressing Markdown/doc noise for non-doc queries and producing visible ranking changes.
- Done: query and show now use `trustLevel` consistently for extraction trust, while query separately exposes `retrievalTrustLevel`.
- Done: `--docs-only` now prefers canonical docs and demotes duplicated operational mirrors by default.
- Done: `status` now reports lightweight file-level change awareness since the last index and, when available, since current git HEAD.
- Done: `lookup` now provides an agent-facing helper for the common query -> top hit -> show flow.
- Done: show returns symbol bodies plus lightweight relations and related symbols, summarizing very large bodies by default and supporting `--full` expansion.

Adoption and workflow
- Done: downstream adoption workflow docs and reusable snippets.
- Done: init bootstraps local .symballist/instructions assets, wrapper commands, and managed AGENTS.md / CLAUDE.md symballist retrieval blocks.
- Done: init now ensures `.gitignore` contains `.symballist/` and prints a manual cleanup hint if that directory already appears to be Git-tracked.
- Done: real dogfooding in co-ma confirms the tool is now genuinely useful for day-to-day discovery, especially for implementation-oriented queries.

Priority order from latest live feedback
- Done: TASK-013 fixed query CLI flag parsing and help handling, including query subcommand help and `--top` alias support.
- Done: TASK-014 improved exact-definition ranking for symbol-shaped queries such as `DistillationEngine`.
- Done: TASK-015 improved query/show ergonomics with tighter default result counts and `show --name`.
- Done: TASK-016 clarified retrieval confidence, score semantics, and trust signaling in query/show output.
- Done: TASK-017 added query intent filters for implementation, docs, and tests.
- Done: TASK-018 strengthened semantic matching for concept-oriented queries through source-path candidate expansion and concept-aware reranking.
- Done: TASK-019 calibrated confidence and match-reason heuristics so trust signals stay meaningful in live query output.
- Done: TASK-020 added summary defaults and `--full` expansion for large `show` results.
- Done: TASK-021 ensures init adds `.symballist/` to `.gitignore` by default.
- Done: TASK-022 strengthened and clarified `--prefer-implementation` so the flag produces a visible code-focused ranking change.
- Done: TASK-023 reconciled query/show trust semantics by splitting extraction trust from retrieval trust.
- Done: TASK-024 preferred canonical docs and demoted duplicate operational docs in docs-only retrieval.
- Done: TASK-025 added lightweight file-level change awareness since index and git HEAD.
- Done: TASK-026 added a CLI-first agent-facing lookup helper on top of query/show.
- Roadmap next: DRAFT-010 automatic repo-local reindexing and watch-driven refresh.
- Roadmap later: DRAFT-011 optional local embeddings and hybrid retrieval.
- Roadmap later: DRAFT-012 graph-aware retrieval and staged graph-RAG evolution.
- Later: DRAFT-008 symbol-level and session-aware change tracking beyond file freshness.

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
- TASK-016 retrieval confidence, score semantics, and trust signals.
- TASK-017 query intent filters for implementation, docs, and tests.
- TASK-018 semantic matching for concept-oriented queries.
- TASK-019 trust-signal calibration for confidence, match reasons, and query-time trust.
- TASK-020 large-show summary defaults and explicit `--full` expansion.
- TASK-021 `.gitignore` bootstrap and tracked-state cleanup hint during init.
- TASK-022 `--prefer-implementation` semantics and visible ranking behavior.
- TASK-023 query/show trust-semantics reconciliation.
- TASK-024 canonical-doc preference and operational-doc suppression in docs-only retrieval.
- TASK-025 lightweight file-level change awareness since index and git HEAD.
- TASK-026 agent-facing `lookup` helper for the common query/show flow.

2026-03-29: Completed TASK-027. symballist watch now provides low-overhead repo-local automatic refresh via polling, with --once for a safe one-shot sweep and --interval-ms for foreground watch mode. This closes the first roadmap step and leaves optional local embeddings + hybrid retrieval as the next major slice.
<!-- SECTION:NOTES:END -->
