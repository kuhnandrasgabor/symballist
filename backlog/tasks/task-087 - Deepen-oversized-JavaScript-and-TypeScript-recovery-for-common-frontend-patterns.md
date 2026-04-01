---
id: TASK-087
title: >-
  Deepen oversized JavaScript and TypeScript recovery for common frontend
  patterns
status: Done
assignee: []
created_date: '2026-04-01 12:58'
updated_date: '2026-04-01 13:00'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend oversized JS/TS recovery beyond top-level imports, classes, and function declarations. Recover exported const function patterns and class methods so large frontend files remain useful without full tree-sitter parsing.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended oversized JavaScript/TypeScript recovery to salvage top-level const/let/var function patterns and first-level class methods/property-arrow handlers. This keeps large frontend files more useful without full parser fidelity. Verification: bun test tests/integration.test.ts (82 pass, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Oversized JS/TS files now recover top-level classes, class methods, and const-style functions instead of degrading directly to file-only fallbacks.
<!-- SECTION:FINAL_SUMMARY:END -->
