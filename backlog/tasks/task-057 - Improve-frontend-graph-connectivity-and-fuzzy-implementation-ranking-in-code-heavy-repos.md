---
id: TASK-057
title: >-
  Improve frontend graph connectivity and fuzzy implementation ranking in
  code-heavy repos
status: Done
assignee: []
created_date: '2026-03-31 08:41'
updated_date: '2026-03-31 19:23'
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
- [x] #1 Fuzzy concept queries in a code-heavy frontend repo more reliably surface the obvious implementation in the top results rather than only retaining it as related context.
- [x] #2 Frontend JS and CSS symbols participate in graph diagnostics more accurately, reducing obviously spurious disconnected/orphan signals where indexed structure exists.
- [ ] #3 Improvements are validated against a downstream real-repo retest rather than only synthetic fixtures.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Downstream retest validated the frontend slice. Fuzzy frontend concept queries now surface the obvious implementation at the top, JS symbol lookups show nonzero outbound connectivity, spurious disconnected/orphan signals are gone for normal frontend code, and status possibleOrphans is now dominated by legitimately suspicious deprecated/experimental areas. Remaining observations are minor graph-diagnostic semantics polish only.
<!-- SECTION:NOTES:END -->
