---
id: TASK-047
title: Support extensionless shell script discovery during indexing
status: Done
assignee: []
created_date: '2026-03-31 05:53'
updated_date: '2026-03-31 05:58'
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
- [x] #1 Extensionless shell scripts with recognizable shebangs or common executable-script patterns are discovered and indexed as shell files
- [x] #2 The added detection does not cause broad false-positive indexing of arbitrary extensionless text files
- [x] #3 Integration coverage proves retrieval can find symbols from an extensionless shell script such as startup
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended repo file discovery so extensionless files can be classified as shell when they contain an explicit shell shebang or enough shell-specific cues in the first lines.
Kept detection conservative by requiring either a shell shebang or a small heuristic score across shell syntax markers, which avoids pulling arbitrary extensionless text files into the index.
Added integration coverage for an extensionless startup script and a nearby extensionless runbook text file to prove positive detection and false-positive avoidance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Symballist now discovers extensionless shell entrypoints such as `startup` during indexing when they look like real shell scripts, while still ignoring arbitrary extensionless text files.
Verified with `bun test` on 2026-03-31: 46 pass, 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
