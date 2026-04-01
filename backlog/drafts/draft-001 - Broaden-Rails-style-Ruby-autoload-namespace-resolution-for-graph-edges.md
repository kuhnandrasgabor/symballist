---
id: DRAFT-001
title: Broaden Rails-style Ruby autoload namespace resolution for graph edges
status: Draft
assignee: []
created_date: '2026-04-01 05:40'
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
