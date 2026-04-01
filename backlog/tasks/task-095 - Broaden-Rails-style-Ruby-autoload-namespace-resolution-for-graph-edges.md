---
id: TASK-095
title: Broaden Rails-style Ruby autoload namespace resolution for graph edges
status: Done
assignee: []
created_date: '2026-04-01 05:40'
updated_date: '2026-04-01 14:46'
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
Expand Ruby cross-file relation inference beyond the current obvious constant-path cases by using Rails app-root conventions and namespace-aware candidate selection. The goal is better graph connectivity for autoloaded constants in models, services, workers, jobs, helpers, and lib while staying explicit about ambiguous resolutions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Broadened Ruby autoload namespace resolution with source-path-aware candidate scoring across Rails-style app roots, including app/lib, concerns, queries, forms, presenters, validators, and existing service/model/controller roots. Resolution still bails out on true score ties instead of guessing. Added integration coverage proving namespaced app/lib constants now produce cross-file uses edges from service code.
<!-- SECTION:NOTES:END -->
