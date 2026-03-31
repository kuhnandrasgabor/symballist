---
id: DRAFT-025
title: Add graph-confidence diagnostics before orphan or dead-code claims
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
Before exposing any dead-code feature, symballist should learn to report safer graph diagnostics such as no known inbound references, only test references, same-file-only connectivity, or disconnected-from-indexed-graph states. Explore a confidence-calibrated diagnostic layer that improves retrieval transparency now and can later serve as the foundation for possible-orphan signals without overclaiming dead code.
<!-- SECTION:DESCRIPTION:END -->
