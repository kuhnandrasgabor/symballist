---
id: TASK-025
title: Add lightweight file-level change awareness since index and git HEAD
status: Done
assignee: []
created_date: '2026-03-29 07:14'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Narrow the broader change-tracking idea into a cheap first slice: surface file-level changes since the last index and since current git HEAD, without introducing symbol-history snapshots, commit-to-commit symbol diffs, or session timelines.

User value:
- gives agents a practical answer to "what changed?" without leaving the CLI
- complements freshness with repo-aware file diffs
- improves daily development ergonomics without adding a background service or heavy historical storage

Observed motivation:
- downstream feedback explicitly asked for "what changed since the last commit"
- current freshness answers safety questions, but not recent-change questions
- the current architecture already tracks indexed files and can cheaply compare against git/file state
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `status` reports file-level changed/new/deleted counts and bounded path samples since the last index.
- [x] #2 `status` reports file-level changed/new/deleted counts and bounded path samples since current git HEAD when git is available.
- [x] #3 The slice stays file-level only and does not introduce symbol-history or session-snapshot storage.
- [x] #4 Regression coverage proves since-index and since-git-HEAD reporting.
<!-- AC:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->
Recommended narrow scope:

- report changed/new/deleted files since last index
- optionally report changed/untracked files since current git HEAD
- expose this in `status` first, and only later decide whether `query` / `show` need lightweight hints

Keep out of scope for this slice:

- symbol-level history
- "which symbols were added this session"
- commit-to-commit symbol diffs
- durable session timelines

Implemented:

- `status` now includes `changeAwareness.sinceIndex`
- `status` now includes `changeAwareness.sinceGitHead`
- `indexFreshness` remains unchanged for compatibility, while path samples live in the new change-awareness block

Verification:

- `bun test` passes with 28 tests
- includes regression coverage for changed/new file reporting since git HEAD
<!-- SECTION:NOTES:END -->
