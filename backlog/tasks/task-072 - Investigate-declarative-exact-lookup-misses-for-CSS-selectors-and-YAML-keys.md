---
id: TASK-072
title: Investigate declarative exact lookup misses for CSS selectors and YAML keys
status: Done
assignee: []
created_date: '2026-03-31 18:07'
updated_date: '2026-03-31 19:14'
labels:
  - search
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fresh downstream feedback says declarative exact lookup still sometimes falls back to query for CSS selectors and YAML keys, despite earlier exact-name parity work. Reproduce the real-repo miss, determine whether this is a regression, coverage gap, or consumer misuse, and restore consistent exact lookup behavior where valid.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended declarative exact lookup handling for real-world literal forms. lookup/show/graph name resolution now tolerates wrapped CSS selectors and YAML keys and falls back to exact-normalized name/signature/path matching when strict literal equality misses. Added integration coverage for quoted declarative lookups. No reindex required because this is retrieval-path logic only.
<!-- SECTION:NOTES:END -->
