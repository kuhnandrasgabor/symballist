---
id: TASK-055
title: Support Dockerfile dot-suffix filenames such as Dockerfile.dashboard
status: Done
assignee: []
created_date: '2026-03-31 07:38'
updated_date: '2026-03-31 07:39'
labels:
  - ux
  - retrieval
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream retesting found that standard Dockerfile paths work correctly, but filenames like Dockerfile.dashboard are not recognized as Dockerfile files. Support common dot-suffix Dockerfile naming conventions without classifying arbitrary files too broadly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dockerfile dot-suffix basenames such as Dockerfile.dashboard are detected as dockerfile language files
- [x] #2 Containerfile dot-suffix basenames receive the same treatment
- [x] #3 Integration coverage proves dot-suffix Dockerfile files are indexed and retrievable as dockerfile symbols
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended filename-based language detection so exact Dockerfile/Containerfile basenames still work and common dot-suffix variants like Dockerfile.dashboard and Containerfile.dev are also treated as dockerfile language files. Added integration coverage proving both variants are discovered, indexed, and retrievable as dockerfile symbols.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dockerfile dot-suffix filenames are now supported. Common names like Dockerfile.dashboard and Containerfile.dev are discovered and indexed as dockerfiles without changing broader extension-based detection. Verified with bun test (49 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
