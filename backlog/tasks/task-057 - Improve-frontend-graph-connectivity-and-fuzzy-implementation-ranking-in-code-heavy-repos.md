---
id: TASK-057
title: >-
  Improve frontend graph connectivity and fuzzy implementation ranking in
  code-heavy repos
status: In Progress
assignee: []
created_date: '2026-03-31 08:41'
updated_date: '2026-03-31 17:31'
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
Implemented a focused frontend-graph slice. JavaScript and TypeScript indexing now emit lightweight import relations and usage relations, including resolution of relative imports to repo-local JS/TS/CSS files. That gives frontend code real graph edges for reranking and diagnostics instead of only symbol extraction. Also expanded root heuristics so common frontend app/resource paths such as dashboard_frontend/, frontend/, web/, static/css/, and styles/ are less likely to be flagged as spurious orphan candidates. Added an integration regression that exercises a fuzzy frontend query plus JS and CSS graph diagnostics end to end.

Added a follow-up frontend retrieval calibration pass. Broad conceptual code queries now treat frontend implementation paths (dashboard_frontend/, frontend/, web/, static/css/, static/js/, styles/, assets/*, public/) more like src/ implementation paths during path-based reranking. Also added lightweight normalized concept-term matching (for cases like workspaces -> workspace) so browser-side implementation symbols can be upgraded from merely related token-overlap hits to strong matches when multiple meaningful concept terms align across the name/signature/body/path. Extended the frontend integration regression to cover a broader natural-language query rather than only the exact phrase case.
<!-- SECTION:NOTES:END -->
