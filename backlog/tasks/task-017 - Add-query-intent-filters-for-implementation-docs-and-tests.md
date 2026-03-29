---
id: TASK-017
title: 'Add query intent filters for implementation, docs, and tests'
status: Done
assignee: []
created_date: '2026-03-28 16:46'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agent feedback suggests symballist would benefit from explicit query intent controls instead of relying only on one global ranking policy. In practice, agents sometimes want implementation-first results, sometimes doc-first results, and sometimes test-heavy results.

Capture a draft for lightweight query-profile controls such as prefer implementation, prefer docs, include tests prominently, or exclude/de-prioritize tests. This should stay compatible with the CLI-first model and should not require a semantic system redesign to be useful.

User value:
- lets agents express what kind of retrieval they want instead of hoping the default ranking guessed correctly
- makes broad concept queries more dependable in mixed code/doc/test repos
- provides a cleaner solution than permanently hard-coding one bias into the base ranking

Observed motivation:
- one agent explicitly suggested prefer implementation, prefer docs, and exclude tests style controls
- both agents described the tool as useful but still needing more control over noisy lower-ranked results
- newer feedback sharpened this into concrete CLI shapes such as `--no-docs`, `--exclude-tests`, `--only-tests`, or a `prefer implementation` mode
- recent live runs showed top 3 results can be strong while result slots 4-5 still pick up ROADMAP or phase-doc noise, which is a good fit for explicit intent controls instead of only more reranking
- later feedback confirmed that `--kind function,class` is already a very effective doc-noise guard in practice, which suggests a first-class `--code-only` or implementation-preferring shorthand could deliver a lot of value quickly
- downstream testing also reinforced that the default experience is still somewhat noisy for new users even though the filtered experience is already strong
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented first-class query intent controls for code/docs/tests filtering and implementation bias.

What changed
- added query flags: `--code-only`, `--docs-only`, `--exclude-tests`, and `--prefer-implementation`
- parser now validates that `--code-only` and `--docs-only` are not combined
- search/rerank path now applies hard filtering for docs/tests when requested and a stronger `src/` vs test/import bias when `--prefer-implementation` is enabled
- query output now includes the selected `intent` block so downstream agents can see which mode produced the results
- updated README and adoption workflow docs with the new query controls

Verification
- `bun test` passes with 19 tests
- live `co-ma` query for `"memory store"` with `--code-only --exclude-tests --prefer-implementation` returns only code results and suppresses test/doc noise
- live `co-ma` query for `"architecture"` with `--docs-only` returns only Markdown results
- live `co-ma` query for `"gateway config api live reload"` with `--code-only --exclude-tests` returns only code results
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added first-class query intent filters so users and agents can explicitly ask for code-only, docs-only, test-excluding, or implementation-leaning retrieval. This makes the stronger filtered experience available directly from the CLI instead of relying only on implicit ranking.
<!-- SECTION:FINAL_SUMMARY:END -->
