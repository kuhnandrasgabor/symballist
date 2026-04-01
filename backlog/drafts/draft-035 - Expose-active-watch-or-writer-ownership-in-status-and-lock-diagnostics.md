---
id: DRAFT-035
title: Expose active watch or writer ownership in status and lock diagnostics
status: Draft
assignee: []
created_date: '2026-04-01 14:03'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A stray long-running symballist watch process in mc-mothership caused database locks, confusing status and query behavior, and made it unclear who owned the writer. Explore surfacing active watch/writer ownership or lock diagnostics in status so users can tell when a repo-local DB is being held open by a background process. This may include lightweight PID/process hints, writer-present booleans, or clearer lock/error messaging, but should avoid expensive or platform-fragile detection as a first slice.
<!-- SECTION:DESCRIPTION:END -->
