---
id: DRAFT-016
title: >-
  Strengthen conceptual retrieval retention and implementation preference for
  fuzzy queries
status: Draft
assignee: []
created_date: '2026-03-29 19:17'
labels:
  - retrieval
  - semantic
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Conceptual and implementation-seeking queries are improved but still inconsistent: semantic candidates are not always retained, some implementation preference cases remain underpowered, and broad conceptual prompts can still miss canonical implementation classes. Track tuning and evaluation work around semantic retention thresholds, hybrid fusion weights, stopword or query-intent handling, and stronger implementation-oriented reranking for cases like ContextAssembler and PruningEngine. Recent feedback also highlighted cases where semantic candidates were retrieved but retained none, conceptual prompts like \"how does context assembly work\" fell through to token overlap on enums, and the `conceptCandidates` channel stayed at zero even when path-based conceptual matching seemed plausible.
<!-- SECTION:DESCRIPTION:END -->
