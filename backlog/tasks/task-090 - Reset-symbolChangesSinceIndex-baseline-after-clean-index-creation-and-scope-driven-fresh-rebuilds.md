---
id: TASK-090
title: >-
  Reset symbolChangesSinceIndex baseline after clean index creation and
  scope-driven fresh rebuilds
status: Done
assignee: []
created_date: '2026-04-01 14:03'
updated_date: '2026-04-01 14:04'
labels:
  - bug
dependencies: []
references:
  - src/commands/index.ts
  - src/db.ts
  - src/commands/status.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a fresh database rebuild, status can report huge symbolChangesSinceIndex.addedCount values even when indexFreshness.stale is false and the current index is the new baseline. This showed up clearly in mc-mothership after applying scope rules and rebuilding from scratch. The symbol-change baseline needs to be reset not only for explicit --rebuild flows, but also for clean DB creation and large scope-driven rebuild paths.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Captured indexed rows before the run and detected when indexing started from an empty database. Fresh bootstrap indexes now reset the symbolChangesSinceIndex summary at the end, just like explicit rebuilds, so first-run status does not report the entire repo as newly added. Verification: bun test tests/integration.test.ts (83 pass, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fresh DB creation and scope-driven clean rebuilds now establish a quiet symbolChangesSinceIndex baseline instead of reporting the whole index as newly added.
<!-- SECTION:FINAL_SUMMARY:END -->
