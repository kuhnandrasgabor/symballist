---
id: TASK-048
title: Improve CSS selector lookup and standalone Dockerfile surfacing
status: Done
assignee: []
created_date: '2026-03-31 06:12'
updated_date: '2026-03-31 06:13'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow up the config-and-ops rollout by tightening two real downstream gaps. First, CSS selector lookup should behave reliably for direct literal selector queries against real .css files. Second, Dockerfiles should surface as standalone retrievable units rather than only appearing indirectly through YAML compose references or stage names. Keep this slice focused on actual .css and Dockerfile files; embedded CSS strings inside source code remain out of scope unless separately prioritized.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Direct selector queries against real .css files return CSS selector hits reliably in integration coverage
- [x] #2 Dockerfiles surface as standalone retrievable records in addition to stage or variable symbols
- [x] #3 Tests cover the intended behavior without implying support for CSS embedded inside code strings
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a standalone non-fallback Dockerfile file record so literal Dockerfile queries can resolve to the file itself rather than relying only on stage or variable symbols.
Strengthened CSS selector retrieval by attaching lightweight selector alias text to actual CSS selector records, which helps literal selector queries survive punctuation and tokenization paths without changing the displayed selector name.
Added integration coverage for direct `.section-header` selector lookup and standalone `Dockerfile` retrieval, while keeping the test scope explicitly limited to real .css and Dockerfile files rather than CSS embedded in source strings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Symballist now surfaces Dockerfiles as standalone retrievable records and handles direct literal CSS selector queries against real .css files more reliably.
This slice intentionally does not claim support for CSS embedded inside code strings.
Verified with `bun test` on 2026-03-31: 46 pass, 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
