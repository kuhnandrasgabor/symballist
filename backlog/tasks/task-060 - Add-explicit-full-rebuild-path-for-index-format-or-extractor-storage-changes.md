---
id: TASK-060
title: Add explicit full-rebuild path for index-format or extractor-storage changes
status: Done
assignee: []
created_date: '2026-03-31 12:39'
updated_date: '2026-03-31 12:50'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Storage-level indexing fixes can currently appear ineffective in existing downstream repos because runIndex skips unchanged files. After the body-storage fix, a downstream retest still showed old ~320-character symbol bodies because the target repo was likely using an index created before the change. Add an explicit full-rebuild path, migration trigger, or documented rebuild command so extractor/storage changes can refresh existing repos without relying on users to delete index.db manually.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 There is a clear supported way to force a full symballist reindex when index-format or extractor-storage behavior changes.
- [x] #2 Docs or CLI guidance tell users when a full rebuild is required instead of watch --once or incremental index.
- [x] #3 A downstream repo can refresh old stored symbol bodies after the body-storage fix without touching source files.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a separate index-content compatibility layer on top of DB schema versioning. The system now tracks CURRENT_INDEX_FORMAT_VERSION in metadata, surfaces indexCompatibility in status, automatically rebuilds unchanged files when the stored index format is outdated, and supports an explicit `symballist index --rebuild` path for manual full rebuilds. Updated README, adoption docs, checked-in snippets, generated guidance templates, and CLI help so users know when incremental refresh is not enough.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed src/db.ts, src/commands/index.ts, src/commands/status.ts, src/commands/watch.ts, src/cli.ts, README.md, src/fs.ts, docs/agent-workflows/symballist-adoption.md, docs/snippets/downstream-agents-symballist.md, docs/snippets/downstream-claude-symballist.md, and tests/integration.test.ts. Verified with bun test tests/integration.test.ts (57 pass, 0 fail), plus CLI help checks for `index --help` and `status --help`.
<!-- SECTION:FINAL_SUMMARY:END -->
