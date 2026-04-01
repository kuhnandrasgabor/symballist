---
id: TASK-088
title: Add oversized Ruby recovery for top-level Rails and Canvas symbols
status: Done
assignee: []
created_date: '2026-04-01 13:01'
updated_date: '2026-04-01 13:02'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace fallback-only oversized Ruby handling with a lightweight recovery pass for top-level modules, classes, methods, singleton methods, and constants so large Rails/Canvas files remain navigable.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a lightweight oversized Ruby recovery path for top-level require statements, modules, classes, methods, singleton methods, and constants. Oversized Rails/Canvas files now produce recovered symbols instead of falling directly to a file fallback when the line-based recovery scan can salvage structure. Verification: bun test tests/integration.test.ts (83 pass, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Oversized Ruby files now recover top-level navigable symbols instead of degrading directly to file-only fallbacks.
<!-- SECTION:FINAL_SUMMARY:END -->
