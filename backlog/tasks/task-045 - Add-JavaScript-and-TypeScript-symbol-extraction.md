---
id: TASK-045
title: Add JavaScript and TypeScript symbol extraction
status: Done
assignee: []
created_date: '2026-03-30 11:38'
updated_date: '2026-03-30 20:16'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the first modern-stack language expansion wave by adding first-class JavaScript and TypeScript indexing support. Cover practical symbol extraction for common repo navigation targets such as classes, functions, methods, exports, interfaces, enums, and type aliases where applicable, while preserving the current fallback behavior for files that cannot be usefully parsed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Symballist indexes common JavaScript and TypeScript file extensions and surfaces those languages in status output
- [x] #2 JavaScript and TypeScript extraction returns useful symbols for common top-level declarations and exported types
- [x] #3 Integration tests cover JS/TS indexing and retrieval without regressing the current languages
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add JS/TS parser dependencies and extend supported language/extension mapping.
2. Implement an extractor for common JavaScript and TypeScript declaration forms with sane fallback behavior.
3. Add integration fixtures/tests for indexing, status, and retrieval of JS/TS symbols.
4. Run the test suite and fix any cross-platform or retrieval regressions.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added first-class JavaScript and TypeScript indexing support by extending the language/extension map, introducing a shared JS/TS tree-sitter extractor, and covering common declaration forms including classes, functions, methods, interfaces, enums, type aliases, and variable-assigned functions. Added integration coverage for JS/TS indexing, retrieval, and status output. Installed and pinned compatible parser packages (`tree-sitter-javascript@0.23.1`, `tree-sitter-typescript@^0.23.2`) and verified the full suite passes on macOS.
<!-- SECTION:FINAL_SUMMARY:END -->
