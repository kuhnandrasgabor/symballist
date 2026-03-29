---
id: DRAFT-003
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
<!-- SECTION:DESCRIPTION:END -->
