---
id: TASK-078
title: Align show CLI with lookup by accepting a positional symbol name
status: To Do
assignee: []
created_date: '2026-04-01 06:11'
labels:
  - bug
  - ux
  - cli
  - global
  - any-scale
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make `symballist show "Name"` work as an intuitive fast path, or otherwise align the CLI surface so `show` and `lookup` do not diverge on basic symbol-name invocation. The current positional-id-only behavior produces confusing errors for first-time users.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 resolves the same symbol as  when no numeric id is supplied
- [ ] #2 Invalid positional ids still produce clear errors without ambiguity
- [ ] #3 CLI help reflects the accepted positional-name behavior or the revised aligned contract
<!-- AC:END -->
