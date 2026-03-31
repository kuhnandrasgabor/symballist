---
id: DRAFT-024
title: Support Dockerfile dot-suffix filenames such as Dockerfile.dashboard
status: Draft
assignee: []
created_date: '2026-03-31 06:30'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream retesting found that standard Dockerfile paths now work correctly, but filenames like `Dockerfile.dashboard` are not recognized as Dockerfile files. Today symballist only treats exact basenames like Dockerfile and Containerfile as Dockerfile language files. Explore whether to support common dot-suffix Dockerfile naming conventions without accidentally classifying arbitrary files too broadly.
<!-- SECTION:DESCRIPTION:END -->
