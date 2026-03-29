---
id: DRAFT-010
title: Add automatic repo-local reindexing and watch-driven refresh
status: Draft
assignee: []
created_date: '2026-03-29 09:12'
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
