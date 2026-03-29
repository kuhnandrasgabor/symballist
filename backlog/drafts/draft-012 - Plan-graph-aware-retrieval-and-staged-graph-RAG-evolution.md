---
id: DRAFT-012
title: Plan graph-aware retrieval and staged graph-RAG evolution
status: Draft
assignee: []
created_date: '2026-03-29 09:12'
labels:
  - idea
  - spike
  - decision
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore how lightweight relations should evolve into graph-aware retrieval, staged expansion, and eventually graph-RAG style agent context assembly without overcommitting too early.

User value:
- turns isolated hits into better local context packages
- helps agents move from “find me the symbol” to “show me the relevant neighborhood”
- provides the long-term path toward deeper agentic code understanding

Expected lift:
- moderate near-term lift if kept to bounded expansion/reranking
- very large long-term strategic payoff
- highest complexity and architecture risk of the three roadmap items
<!-- SECTION:DESCRIPTION:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->
Recommended staged path:

1. strengthen graph-aware reranking using existing containment/import relations
2. add bounded expansion around top hits
3. only later consider larger graph-RAG style context assembly

Keep the early slices small:

- no full knowledge graph platform
- no deep recursive traversal by default
- no “graph-RAG” implementation just for branding

Why this belongs after hybrid retrieval:

- stronger first-hit quality makes graph expansion more useful
- graph-aware retrieval compounds the value of good lexical + semantic ranking
- this is the most strategic layer, but not the fastest near-term win
<!-- SECTION:NOTES:END -->
