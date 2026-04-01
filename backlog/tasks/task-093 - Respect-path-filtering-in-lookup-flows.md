---
id: TASK-093
title: Respect --path filtering in lookup flows
status: Done
assignee: []
created_date: '2026-04-01 14:35'
updated_date: '2026-04-01 14:43'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a real positive path filter via --path for query and lookup flows. CLI now parses repeated --path fragments into includePaths, search eligibility enforces them, and integration coverage proves lookup can disambiguate duplicate symbols by path and returns no result when the path filter excludes every candidate.
<!-- SECTION:NOTES:END -->
