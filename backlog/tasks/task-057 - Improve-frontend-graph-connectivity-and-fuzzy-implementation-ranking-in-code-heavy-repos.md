---
id: TASK-057
title: >-
  Improve frontend graph connectivity and fuzzy implementation ranking in
  code-heavy repos
status: To Do
assignee: []
created_date: '2026-03-31 08:41'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing shows exact lookup, config/ops retrieval, path payloads, and weak-result signaling are all strong, but fuzzy concept retrieval in browser-heavy code remains inconsistent. Implementation hits are often retained but sometimes only as related with noStrongMatch true, and many frontend JS/CSS symbols still appear disconnected from the indexed graph or as possible orphan candidates even when symbol extraction is correct. Improve frontend-side relation extraction, graph-aware reranking, or confidence calibration so browser code participates more convincingly in graph-aware retrieval and diagnostics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fuzzy concept queries in a code-heavy frontend repo more reliably surface the obvious implementation in the top results rather than only retaining it as related context.
- [ ] #2 Frontend JS and CSS symbols participate in graph diagnostics more accurately, reducing obviously spurious disconnected/orphan signals where indexed structure exists.
- [ ] #3 Improvements are validated against a downstream real-repo retest rather than only synthetic fixtures.
<!-- AC:END -->
