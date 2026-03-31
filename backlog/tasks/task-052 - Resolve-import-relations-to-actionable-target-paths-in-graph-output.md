---
id: TASK-052
title: Resolve import relations to actionable target paths in graph output
status: Done
assignee: []
created_date: '2026-03-31 06:47'
updated_date: '2026-03-31 06:48'
labels:
  - graph
  - retrieval
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Relation output is useful, but import relations still surface targetPath: null or package-level paths in cases where the imported submodule is indexed directly. Resolve import-style relations to indexed file paths whenever possible so relation graphs and lookup output become directly actionable for code navigation and graph-aware retrieval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Import-style relations prefer concrete indexed module file paths over null or package __init__ paths when the imported submodule is resolvable
- [x] #2 Lookup/show relation output exposes actionable targetPath values for from-package-import-submodule cases
- [x] #3 Integration coverage proves a from-package-import-submodule relation resolves to the concrete module file
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adjusted Python import relation extraction so  prefers the concrete indexed submodule file path when it exists, instead of leaving targetPath null or pointing at the package __init__. Added integration coverage proving both DB relations and lookup output resolve  to .

Correction: resolved import relations for patterns like from package import submodule so they prefer the concrete indexed submodule file path, and verified lookup/show can surface target paths like pkg/helpers.py.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Import relations now resolve to actionable module paths more often. In particular, from-package-import-submodule cases prefer the indexed submodule file, so lookup/show relation output is directly navigable instead of stopping at package-level labels. Verified with bun test (49 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
