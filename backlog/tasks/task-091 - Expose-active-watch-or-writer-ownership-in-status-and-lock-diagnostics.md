---
id: TASK-091
title: Expose active watch or writer ownership in status and lock diagnostics
status: Done
assignee: []
created_date: '2026-04-01 14:03'
updated_date: '2026-04-01 14:13'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A stray long-running symballist watch process in mc-mothership caused database locks, confusing status and query behavior, and made it unclear who owned the writer. Explore surfacing active watch/writer ownership or lock diagnostics in status so users can tell when a repo-local DB is being held open by a background process. This may include lightweight PID/process hints, writer-present booleans, or clearer lock/error messaging, but should avoid expensive or platform-fragile detection as a first slice.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented repo-local watch ownership heartbeat tracking and surfaced watchOwnership in status. Watch now writes pid/startedAt/lastHeartbeatAt/interval metadata while active and clears ownership on normal exit. Status reports present/active/stale ownership state, enabling stale orphaned watch detection without OS-specific process scanning. Added integration coverage for clean one-shot watch teardown and stale orphaned heartbeat visibility.
<!-- SECTION:NOTES:END -->
