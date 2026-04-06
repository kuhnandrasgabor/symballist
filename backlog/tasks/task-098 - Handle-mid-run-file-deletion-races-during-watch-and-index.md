---
id: TASK-098
title: Handle mid-run file deletion races during watch and index
status: Done
assignee: []
created_date: '2026-04-04 23:29'
updated_date: '2026-04-06 16:23'
labels:
  - bug
  - watch
  - indexing
  - freshness
dependencies: []
references:
  - src/commands/index.ts
  - src/fs.ts
  - tests/integration.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream report from D:\Projects\co-ma showed `symballist watch` failing with `ENOENT` for a deleted temp file (`tmp-chat-context-check.js`). Current intake suggests missing files are removed from the stored index after source discovery, but `runIndex` still reads file contents without downgrading a file-not-found race if a path disappears between discovery and content read. The result is that transient temp-file churn can abort a watch or index cycle instead of completing and cleaning up the vanished path gracefully.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 symballist index does not fail when a supported file is removed after discovery but before its contents are read.
- [x] #2 symballist watch --once handles the same disappearance race without aborting the refresh cycle.
- [x] #3 The missing path is removed or safely skipped so the run completes with no stale indexed entry left behind.
- [x] #4 Regression coverage exists for the mid-cycle deletion race.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a deterministic regression fixture that exercises a file disappearing after discovery and before content read.
2. Update the incremental indexing path so `ENOENT` during per-file read is treated as an expected removal race instead of a fatal error.
3. Verify index and watch behavior still clear freshness and report sensible removed-file stats.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Intake summary
- User saw `ENOENT: no such file or directory, open 'D:\Projects\co-ma\tmp-chat-context-check.js'` while running `watch`.

Related backlog items
- TASK-027 added watch-driven refresh.
- TASK-081 added repo-scoped scope control and already covers stale-on-scope removal, but not files that vanish during an active indexing pass.

Provisional code observation
- `src/commands/index.ts` removes missing indexed paths after comparing `currentPaths` against `existingFiles`, but still calls `readText(file.absolutePath)` in the per-file loop without handling `ENOENT`, so a file that disappears after discovery can still abort the cycle.

Recommended next action
- Treat this as a narrow follow-up bug rather than a scope-control issue.

Implemented mid-run missing-file race handling in the indexing loop.
- src/fs.ts now exposes isFileNotFoundError() and returns null from fileMetadata() on ENOENT so a path that vanishes before stat does not fall into stale backfill or reindex paths.
- src/commands/index.ts now treats ENOENT during per-file reads as an expected disappearance race: it removes the path from currentPaths, deletes any stale indexed row, and continues instead of aborting the run.
- Added deterministic integration regressions that delete tmp-chat-context-check.js exactly when file contents are read so both runIndex() and runWatch({ once: true }) cover the mid-cycle deletion case.

Verification
- Task-specific index and watch integration regressions passed.
- Nearby freshness and lexical indexing regressions passed.
- Two long-running indexing regressions passed with an extended per-test timeout.
- A broad bun test run still reports unrelated graph/relation failures and some Windows temp-dir EBUSY cleanup noise outside the task-098 write set.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Handled ENOENT deletion races during incremental indexing and one-shot watch refreshes by downgrading vanished files into cleanup/skips instead of fatal errors.
Added deterministic regression coverage for both direct index runs and watch --once, and verified the stale indexed entry is removed when the file disappears mid-run.
Targeted integration tests passed; the broad bun test run still shows unrelated graph/relation failures outside this task.
<!-- SECTION:FINAL_SUMMARY:END -->
