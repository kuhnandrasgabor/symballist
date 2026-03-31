---
id: TASK-072
title: Investigate declarative exact lookup misses for CSS selectors and YAML keys
status: To Do
assignee: []
created_date: '2026-03-31 18:07'
labels:
  - search
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fresh downstream feedback says declarative exact lookup still sometimes falls back to query for CSS selectors and YAML keys, despite earlier exact-name parity work. Reproduce the real-repo miss, determine whether this is a regression, coverage gap, or consumer misuse, and restore consistent exact lookup behavior where valid.
<!-- SECTION:DESCRIPTION:END -->
