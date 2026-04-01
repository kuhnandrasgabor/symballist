---
id: TASK-096
title: 'Resolve Ruby worker, job, and service constant call edges across files'
status: Done
assignee: []
created_date: '2026-04-01 05:40'
updated_date: '2026-04-01 14:48'
labels:
  - idea
  - ruby
  - graph
  - language-specific
  - any-scale
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deepen Ruby cross-file graph utility by resolving obvious constant receiver calls such as FooWorker.perform_async, JobClass.perform_later, and service-class calls to repo-local Ruby targets when the file path is unambiguous. Focus on high-confidence static edges that materially improve Rails and Canvas workflows.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Kept Ruby constant-receiver target resolution conservative but upgraded relation labels for resolved cross-file calls so worker/job/service invocations retain the invoked method name. Calls like ArchiveClassroomWorker.perform_async, SyncStudentsJob.perform_later, and Notifications::Dispatch.call now emit uses edges to the right target files with method-qualified labels for clearer graph traversal and related-symbol context.
<!-- SECTION:NOTES:END -->
