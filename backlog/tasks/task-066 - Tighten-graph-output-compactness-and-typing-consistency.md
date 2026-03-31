---
id: TASK-066
title: Tighten graph output compactness and typing consistency
status: Done
assignee: []
created_date: '2026-03-31 16:29'
updated_date: '2026-03-31 16:32'
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
- [x] #1 Graph --compact omits neighbor bodies and keeps payloads materially smaller for connected symbols
- [x] #2 Grouped graph collections use stable list typing even when empty
- [x] #3 Integration coverage validates compact graph payload shape and empty-group typing
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the graph-output consumption issues from downstream testing. `graph --compact` now strips neighbor symbol bodies and other bulky fields so connected graph responses stay much smaller, and grouped graph collections are now list-only with edge counts moved to a separate `graphSummary` block.

Added regression coverage for compact graph payload shape, body stripping, and stable empty-group typing. Verified with `bun test tests/integration.test.ts` and `bun run src/cli.ts graph --help`.
<!-- SECTION:FINAL_SUMMARY:END -->
