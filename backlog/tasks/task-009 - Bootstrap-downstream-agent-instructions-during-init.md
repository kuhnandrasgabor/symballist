---
id: TASK-009
title: Bootstrap downstream agent instructions during init
status: Done
assignee: []
created_date: '2026-03-28 16:30'
updated_date: '2026-03-28 16:34'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teach symballist init to scaffold downstream adoption assets automatically. The first slice should copy local guidance into .symballist and upsert managed Codex/Claude instruction blocks into root AGENTS.md and CLAUDE.md so projects get a working CLI-first symballist integration without manual copy-paste.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 init copies downstream symballist guidance assets into the target repo's .symballist area.
- [x] #2 init creates or updates managed symballist instruction blocks in root AGENTS.md and CLAUDE.md without duplicating them on repeated runs.
- [x] #3 Integration coverage proves init is idempotent and writes the expected files/content.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended init to copy rendered symballist adoption assets into .symballist/instructions and to upsert managed SYMBALLIST RETRIEVAL blocks into root AGENTS.md and CLAUDE.md.

The bootstrap is idempotent: rerunning init refreshes the managed block in place instead of duplicating it, while preserving any existing file content outside the marked region.

Updated the adoption docs and snippets to use placeholders so init can render repo-specific commands and local instruction references automatically.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
symballist init now bootstraps downstream agent integration automatically. Verified with bun test, including an idempotent init test that checks .symballist/instructions plus managed AGENTS.md and CLAUDE.md updates.
<!-- SECTION:FINAL_SUMMARY:END -->
