---
id: TASK-093
title: Respect --path filtering in lookup flows
status: To Do
assignee: []
created_date: '2026-04-01 14:35'
labels:
  - bug
  - retrieval
  - cli
  - global
  - any-scale
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The retrieval CLI accepts --path constraints but lookup does not currently honor them in result selection. Make path-scoped lookup searches actually restrict candidate admission and ranking so users can disambiguate by file path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lookup with --path only returns candidates from matching paths
- [ ] #2 non-matching --path filters produce no result rather than silently ignoring the filter
- [ ] #3 integration coverage proves lookup path scoping works for exact and ambiguous symbol names
<!-- AC:END -->
