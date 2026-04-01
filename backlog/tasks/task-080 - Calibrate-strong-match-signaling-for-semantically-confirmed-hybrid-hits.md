---
id: TASK-080
title: Calibrate strong-match signaling for semantically confirmed hybrid hits
status: Done
assignee: []
created_date: '2026-04-01 06:12'
updated_date: '2026-04-01 06:35'
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
- [x] #1 Semantically confirmed hybrid hits with clear practical separation can surface as strong when appropriate
- [x] #2 No-strong-match remains conservative for genuinely weak or noisy queries
- [x] #3 Regression coverage includes a non-exact hybrid query that now upgrades appropriately
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adjusted src/commands/resultQuality.ts so top-level retrieval quality can upgrade a semantically confirmed high-trust related hit to strong when the semantic signal is clear and the top result is meaningfully separated from alternatives. This leaves core per-result confidence assignment unchanged and keeps weak lexical-only related hits in the existing moderate or weak buckets.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated src/commands/resultQuality.ts, src/types.ts, and tests/integration.test.ts. Added regression coverage showing a semantic-assisted related top hit now reports strong quality without loosening genuinely weak results. Verified with bun test tests/integration.test.ts (75 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
