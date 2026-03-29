---
id: TASK-024
title: >-
  Prefer canonical docs and suppress duplicate operational docs in docs-only
  retrieval
status: Done
assignee: []
created_date: '2026-03-28 22:21'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent downstream feedback says --docs-only works, but rankings can still be noisy because duplicated operational docs such as AGENTS.md and CLAUDE.md can outrank the canonical project documentation the user likely wants first. Capture a follow-up to prefer canonical docs like README.md, plan.md, and curated docs/ sources while suppressing duplicates and repo-internal operational mirrors when the query intent is documentation-focused. User value: makes docs-only retrieval feel deliberate and less repetitive, especially for onboarding and architecture lookup. Observed motivation: downstream testing reported memory management and related docs queries surfacing duplicated operational docs above the more canonical project docs that would be more useful first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `--docs-only` prefers canonical documentation paths like `docs/`, `README.md`, and `plan.md`.
- [x] #2 Duplicated operational mirrors such as `AGENTS.md`, `CLAUDE.md`, and hidden instruction mirrors are demoted in docs-focused retrieval instead of outranking canonical docs by default.
- [x] #3 Regression coverage proves the new ranking behavior.
- [x] #4 User-facing docs mention the improved docs-only behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in the ranking layer rather than as a hard filter:

- Added canonical-doc path preference for `docs/`, `README.md`, `plan.md`, and `ROADMAP.md`.
- Added stronger docs-only penalties for duplicated operational mirrors such as `AGENTS.md`, `CLAUDE.md`, and hidden `.codex/` / `.claude/` / `.symballist/` instruction files.
- Kept operational docs visible when they are the only relevant matches, but pushed them below canonical docs by default.

Verification:

- `bun test` passes with 27 tests.
- Added a regression proving `--docs-only` ranks a curated `docs/` file and `README.md` above duplicated operational mirrors.
- Live `co-ma` docs-only queries now surface canonical docs first instead of leading with agent instruction files.
<!-- SECTION:NOTES:END -->
