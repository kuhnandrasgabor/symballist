---
id: TASK-017
title: 'Add query intent filters for implementation, docs, and tests'
status: Draft
assignee: []
created_date: '2026-03-28 16:46'
labels: []
dependencies: []
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
