---
id: TASK-035
title: 'Add init setup modes for CLI, tool, and hybrid downstream integration'
status: To Do
assignee: []
created_date: '2026-03-29 18:29'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a setup-type option to symballist init so downstream repos can choose CLI-only guidance, tool-first guidance, or a hybrid setup. Keep CLI wrappers as the robust fallback, default to hybrid, persist the selected mode in repo-local config, and make init bootstrap the appropriate instructions/assets without forcing one integration style on every repo.
<!-- SECTION:DESCRIPTION:END -->
