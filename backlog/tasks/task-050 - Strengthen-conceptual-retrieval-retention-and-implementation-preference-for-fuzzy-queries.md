---
id: TASK-050
title: >-
  Strengthen conceptual retrieval retention and implementation preference for
  fuzzy queries
status: Done
assignee: []
created_date: '2026-03-31 06:41'
updated_date: '2026-03-31 06:44'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Conceptual and implementation-seeking queries are improved but still inconsistent: semantic candidates are not always retained, some implementation preference cases remain underpowered, and broad conceptual prompts can still miss canonical implementation classes. Execute a focused tuning slice around broad natural-language conceptual queries, concept-path candidate admission, and stronger implementation-oriented reranking so canonical implementation symbols survive fuzzy prompts more reliably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Broad conceptual implementation-seeking queries retain or promote canonical implementation symbols more reliably in integration coverage
- [x] #2 Concept-path candidate admission and reranking handle natural-language filler terms more gracefully without degrading exact-symbol behavior
- [x] #3 Tests cover at least one fuzzy conceptual query that previously would have fallen to weaker non-implementation matches
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a focused lexical/reranking slice for broad conceptual code prompts. Added conceptual stopword filtering for concept-path admission and Dockerfile-query term analysis, broadened concept candidate expansion to ignore filler words, and strengthened implementation-oriented reranking for src definitions while making markdown docs less competitive on broad non-doc conceptual queries. Added integration coverage for a stopword-heavy natural-language prompt ('how does memory store work') to prove canonical src implementations beat doc/test noise without regressing exact-symbol behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Broad conceptual natural-language code queries now retain canonical src implementations more reliably. Concept-path and related heuristics ignore filler terms such as how/does/work, broad non-doc conceptual prompts apply stronger implementation-friendly reranking, and integration coverage now locks in the behavior with a regression over doc and test noise. Verified with bun test (47 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
