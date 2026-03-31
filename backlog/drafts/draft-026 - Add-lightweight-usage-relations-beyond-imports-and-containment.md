---
id: DRAFT-026
title: Add lightweight usage relations beyond imports and containment
status: Draft
assignee: []
created_date: '2026-03-31 07:49'
labels:
  - graph
  - retrieval
  - idea
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current graph is strong enough for one-hop reranking and navigation, but too shallow for reliable orphan or dead-code heuristics. Explore adding lightweight usage-style relations beyond contained_in and imports, such as symbol references, call-like edges, or other bounded inbound/outbound usage links where extraction confidence is high enough. Primary value is better retrieval reranking and context expansion; a secondary value is making future orphan diagnostics less noisy.
<!-- SECTION:DESCRIPTION:END -->
