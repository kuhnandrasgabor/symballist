---
id: TASK-047
title: Support extensionless shell script discovery during indexing
status: To Do
assignee: []
created_date: '2026-03-31 05:53'
updated_date: '2026-03-31 05:54'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing found that shell retrieval missed operational scripts whose filenames have no extension, such as a startup script named simply `startup`. Symballist currently indexes shell files by extension but does not reliably detect extensionless executable or shebang-based scripts. Add pragmatic discovery for common extensionless shell scripts so operational entrypoints are not silently skipped.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extensionless shell scripts with recognizable shebangs or common executable-script patterns are discovered and indexed as shell files
- [ ] #2 The added detection does not cause broad false-positive indexing of arbitrary extensionless text files
- [ ] #3 Integration coverage proves retrieval can find symbols from an extensionless shell script such as startup
<!-- AC:END -->
