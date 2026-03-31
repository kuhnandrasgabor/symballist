---
id: TASK-069
title: Add type and interface-aware search for typed languages
status: Done
assignee: []
created_date: '2026-03-31 13:04'
updated_date: '2026-03-31 17:50'
labels:
  - feature
  - feedback
  - search
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opus feedback: once signatures are indexed, queries such as what accepts a WorkspaceConfig or what returns list[int] become possible. Explore extracting and searching parameter and return type information for TypeScript and typed Python.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a first typed-search slice for TypeScript and typed Python. Python function signatures now retain return annotations such as -> List[int] during parsed and recovered extraction, and retrieval now recognizes typed query intent like "what accepts WorkspaceConfig" or "what returns list int" as strong signature-text matches for typed-language definitions. Added integration coverage validating both TypeScript parameter-type search and Python return-type search.
<!-- SECTION:FINAL_SUMMARY:END -->
