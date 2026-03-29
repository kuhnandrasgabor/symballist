---
id: TASK-004
title: Add lightweight import relations
status: Done
assignee: []
created_date: '2026-03-28 14:35'
updated_date: '2026-03-28 14:40'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Persist lightweight structural relations for indexed symbols so symballist can expose basic graph context without committing to a full graph architecture yet. The first slice should focus on Python import links and simple containment metadata that can be used to surface related symbols in retrieval output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Indexing persists lightweight relation records for supported sources without regressing current symbol/query behavior.
- [x] #2 Python import relations are surfaced as related context for relevant symbols or files in retrieval output.
- [x] #3 The implementation stays lightweight and does not require a separate daemon or full graph traversal engine.
- [x] #4 Integration coverage proves relation data is stored and can be retrieved from indexed fixture content.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Persisted a lightweight relations table alongside symbols and files, storing containment for non-file symbols and resolved Python import links when targets are known in the indexed repo.

Extended show output to include relations and added integration coverage proving greet in the fixture repo resolves both contained_in -> app.py and imports -> helpers.py.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added lightweight import and containment relations without introducing a daemon or graph engine. Verified with bun test and a live fixture run: query greet followed by show returned contained_in and imports relations.
<!-- SECTION:FINAL_SUMMARY:END -->
