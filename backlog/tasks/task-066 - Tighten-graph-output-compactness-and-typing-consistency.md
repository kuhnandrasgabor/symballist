---
id: TASK-066
title: Tighten graph output compactness and typing consistency
status: To Do
assignee: []
created_date: '2026-03-31 16:29'
labels:
  - bug
  - graph
  - feedback
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing found two graph-output issues after the new traversal command landed: compact graph responses still include full neighbor symbol bodies and can blow past tool-output limits, and at least one grouped graph field surfaced as an integer instead of an empty list, causing consumer parsing failures. Tighten graph output so compact mode is truly compact and grouped relation fields stay type-stable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Graph --compact omits neighbor bodies and keeps payloads materially smaller for connected symbols
- [ ] #2 Grouped graph collections use stable list typing even when empty
- [ ] #3 Integration coverage validates compact graph payload shape and empty-group typing
<!-- AC:END -->
