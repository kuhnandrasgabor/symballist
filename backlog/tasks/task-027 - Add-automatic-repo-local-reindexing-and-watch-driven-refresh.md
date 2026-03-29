---
id: TASK-027
title: Add automatic repo-local reindexing and watch-driven refresh
status: Done
assignee: []
created_date: '2026-03-29 09:12'
updated_date: '2026-03-29 09:20'
labels:
  - idea
  - spike
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore the next operational step after manual indexing: keep the local index fresh automatically with a low-overhead repo-local watcher or refresh loop that only reindexes changed files.

User value:
- removes the biggest remaining manual friction in daily use
- makes `symballist` feel alive instead of batch-oriented
- increases trust because freshness becomes easier to maintain continuously

Expected lift:
- high day-to-day UX lift
- moderate retrieval-quality lift indirectly through fresher indexes
- likely the best short-term payoff after the current CLI slice
<!-- SECTION:DESCRIPTION:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->
Recommended first slice:

- watch or poll the repo for changed indexed files
- reuse the existing changed-file incremental index path
- keep it repo-local and optional
- surface simple operational controls first, for example `symballist watch` or a lightweight background refresh mode

Keep out of scope initially:

- cross-repo daemon management
- deep process supervision
- full background service orchestration
- any requirement that agents or users must use the watcher

Why this fits next:

- high practical lift for low-to-moderate implementation cost
- builds directly on existing incremental indexing and freshness detection
- reduces the pressure on every agent to remember to run `index`
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a low-overhead foreground watch mode via symballist watch with --once and --interval-ms, reusing the existing incremental indexer instead of introducing a daemon. Updated CLI parsing/help, README/adoption snippets, and init-propagated instructions so downstream repos learn the new flow automatically. Verification: un test (31 pass), un run src/cli.ts watch --help, un run src/cli.ts watch --once --root D:\Projects\symballist.
<!-- SECTION:FINAL_SUMMARY:END -->
