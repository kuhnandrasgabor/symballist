---
id: DRAFT-014
title: Add compact output mode for agent-facing symballist responses
status: Draft
assignee: []
created_date: '2026-03-29 19:17'
labels:
  - ux
  - agent-experience
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Symballist responses now carry useful metadata, but repeated legend and semantics blocks are expensive for agent consumers. Track a compact or terse response mode that preserves the important result payload while trimming repeated static explanations, especially for query, lookup, and show. Consider whether legends should move to status/help, become opt-in, or be suppressed automatically in machine-oriented mode. The motivating live feedback is that resultSemantics, trustSemantics, retrieval.embeddings config details, and other repeated explanatory blocks can consume a large fraction of every response even when the agent only needs the ranked results and key trust fields.
<!-- SECTION:DESCRIPTION:END -->
