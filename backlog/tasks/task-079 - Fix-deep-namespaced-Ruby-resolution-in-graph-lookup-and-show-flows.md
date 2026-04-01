---
id: TASK-079
title: Fix deep namespaced Ruby resolution in graph lookup and show flows
status: Done
assignee: []
created_date: '2026-04-01 06:11'
updated_date: '2026-04-01 06:29'
labels:
  - bug
  - ruby
  - graph
  - language-specific
  - any-scale
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing on a large Rails codebase still reports misses for deep fully-qualified Ruby names in graph-name and direct-name flows. Extend exact-name resolution so namespaced Ruby identifiers resolve reliably without forcing users to guess a short name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Graph name lookup resolves deeply namespaced Ruby symbols when the fully-qualified name is indexed
- [x] #2 The same qualified-name behavior is consistent across lookup, show, and graph
- [x] #3 Regression coverage includes a multi-segment Ruby namespace case representative of Rails or Canvas repos
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tightened getBestSymbolByName ordering in src/db.ts so exact-name and exact-signature Ruby matches are ranked deterministically before normalized suffix matches and generic fallbacks. This fixes deep namespaced Ruby lookups on large repos where many duplicate short-name symbols exist. Added a regression covering Sis::V2::Services::Writing::Student competing with a top-level Student class.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated src/db.ts and tests/integration.test.ts. Deep fully-qualified Ruby names now resolve consistently across lookup, show, and graph even when duplicate short-name symbols exist elsewhere in the repo. Verified with bun test tests/integration.test.ts (73 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
