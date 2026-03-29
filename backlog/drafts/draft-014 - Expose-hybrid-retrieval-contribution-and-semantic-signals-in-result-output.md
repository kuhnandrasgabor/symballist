---
id: DRAFT-014
title: Expose hybrid retrieval contribution and semantic signals in result output
status: Draft
assignee: []
created_date: '2026-03-29 15:42'
labels:
  - idea
  - spike
  - decision
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback summary
- Agents confirmed that retrieval.mode now reports hybrid and queryEmbedded is true, but semanticSimilarity is often null and matchReason rarely makes the semantic channel visible.
- As a result, it is hard to tell whether embeddings are materially helping or simply adding latency behind the scenes.

Why it matters
- Hybrid retrieval is now part of the product promise, so its contribution needs to be observable enough to tune and trust.
- Without visibility, it is difficult to judge whether fusion weights are right, whether semantic candidates are entering the merged set, or whether lexical ranking is still dominating everything.

Suggested direction
- Surface when semantic candidates were considered, admitted, or suppressed during fusion.
- Populate semanticSimilarity or equivalent channel-level diagnostics consistently when semantic retrieval contributes.
- Consider exposing richer result explanations such as lexical-only, semantic-assisted, or semantic-led matches.

Expected outcome
- Agents can tell when embeddings actually influenced ranking, and future tuning can be based on visible evidence rather than guesswork.
<!-- SECTION:DESCRIPTION:END -->
