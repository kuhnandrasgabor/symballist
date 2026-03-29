---
id: DRAFT-010
title: Add lightweight file-level change awareness since index and git HEAD
status: Draft
assignee: []
created_date: '2026-03-29 07:14'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Narrow the broader change-tracking idea into a cheap first slice: surface file-level changes since the last index and since current git HEAD, without introducing symbol-history snapshots, commit-to-commit symbol diffs, or session timelines.

User value:
- gives agents a practical answer to “what changed?” without leaving the CLI
- complements freshness with repo-aware file diffs
- improves daily development ergonomics without adding a background service or heavy historical storage

Observed motivation:
- downstream feedback explicitly asked for “what changed since the last commit”
- current freshness answers safety questions, but not recent-change questions
- the current architecture already tracks indexed files and can cheaply compare against git/file state
<!-- SECTION:DESCRIPTION:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->
Recommended narrow scope:

- report changed/new/deleted files since last index
- optionally report changed/untracked files since current git HEAD
- expose this in `status` first, and only later decide whether `query` / `show` need lightweight hints

Keep out of scope for this slice:

- symbol-level history
- “which symbols were added this session”
- commit-to-commit symbol diffs
- durable session timelines

Recommended next action:

- promote this draft when we want a low-overhead change-awareness pass
<!-- SECTION:NOTES:END -->
