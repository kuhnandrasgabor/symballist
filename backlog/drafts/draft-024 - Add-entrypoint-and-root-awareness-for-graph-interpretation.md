---
id: DRAFT-024
title: Add entrypoint and root awareness for graph interpretation
status: Draft
assignee: []
created_date: '2026-03-31 07:49'
labels:
  - graph
  - retrieval
  - idea
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Many symbols look disconnected unless the system knows about CLI entrypoints, framework hooks, startup modules, and other graph roots. Explore a lightweight root-awareness layer that can mark likely entrypoints or externally-invoked symbols so retrieval and future orphan diagnostics do not over-penalize them. Primary value is reducing graph-noise in retrieval and relation interpretation; a secondary value is making maintenance signals safer later.
<!-- SECTION:DESCRIPTION:END -->
