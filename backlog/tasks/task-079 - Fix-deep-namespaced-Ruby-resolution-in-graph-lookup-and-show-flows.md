---
id: TASK-079
title: Fix deep namespaced Ruby resolution in graph lookup and show flows
status: To Do
assignee: []
created_date: '2026-04-01 06:11'
labels:
  - bug
  - ruby
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing on a large Rails codebase still reports misses for deep fully-qualified Ruby names in graph-name and direct-name flows. Extend exact-name resolution so namespaced Ruby identifiers resolve reliably without forcing users to guess a short name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Graph name lookup resolves deeply namespaced Ruby symbols when the fully-qualified name is indexed
- [ ] #2 The same qualified-name behavior is consistent across lookup, show, and graph
- [ ] #3 Regression coverage includes a multi-segment Ruby namespace case representative of Rails or Canvas repos
<!-- AC:END -->
