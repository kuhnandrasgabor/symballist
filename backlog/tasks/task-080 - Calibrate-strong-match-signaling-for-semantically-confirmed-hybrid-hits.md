---
id: TASK-080
title: Calibrate strong-match signaling for semantically confirmed hybrid hits
status: To Do
assignee: []
created_date: '2026-04-01 06:12'
labels:
  - feature
  - retrieval
  - global
  - any-scale
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Relax or refine result-quality and no-strong-match thresholds so clearly correct hybrid results do not stay labeled as moderate merely because lexical overlap is imperfect. This should reduce unnecessary agent hedging and retry loops when lexical and semantic channels agree on a practical winner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Semantically confirmed hybrid hits with clear practical separation can surface as strong when appropriate
- [ ] #2 No-strong-match remains conservative for genuinely weak or noisy queries
- [ ] #3 Regression coverage includes a non-exact hybrid query that now upgrades appropriately
<!-- AC:END -->
