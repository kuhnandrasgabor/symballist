---
id: DRAFT-029
title: 'Resolve Ruby worker, job, and service constant call edges across files'
status: Draft
assignee: []
created_date: '2026-04-01 05:40'
labels:
  - idea
  - ruby
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deepen Ruby cross-file graph utility by resolving obvious constant receiver calls such as FooWorker.perform_async, JobClass.perform_later, and service-class calls to repo-local Ruby targets when the file path is unambiguous. Focus on high-confidence static edges that materially improve Rails and Canvas workflows.
<!-- SECTION:DESCRIPTION:END -->
