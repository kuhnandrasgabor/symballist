---
id: TASK-090
title: >-
  Reset symbolChangesSinceIndex baseline after clean index creation and
  scope-driven fresh rebuilds
status: To Do
assignee: []
created_date: '2026-04-01 14:03'
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
