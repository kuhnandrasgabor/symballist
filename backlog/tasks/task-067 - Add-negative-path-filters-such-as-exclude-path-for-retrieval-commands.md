---
id: TASK-067
title: Add negative path filters such as --exclude-path for retrieval commands
status: Done
assignee: []
created_date: '2026-03-31 13:04'
updated_date: '2026-03-31 17:40'
labels:
  - feature
  - feedback
  - ux
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opus feedback: exclude-tests is helpful, but real repos also need targeted suppression of legacy or deprecated zones. Add path-oriented negative filters so queries can ignore directories such as _deprecated or legacy without requiring query wording hacks.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented negative path suppression for retrieval commands. query and lookup now accept repeated --exclude-path flags, QueryIntentOptions carries excludePaths, search filtering excludes matching path fragments case-insensitively, and the CLI help/docs/tool-manifest guidance all expose the new control. Added integration coverage for both parser behavior and real retrieval suppression of _deprecated/ and legacy paths.
<!-- SECTION:FINAL_SUMMARY:END -->
