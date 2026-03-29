---
id: TASK-020
title: Add summary mode or truncation defaults for large show results
status: Done
assignee: []
created_date: '2026-03-28 18:23'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback from real downstream use says show --name on large classes such as MemoryStore can return bodies that are technically correct but impractically large for normal navigation. Capture a draft to explore better defaults for very large symbol bodies, such as summary mode, first-N-lines output, explicit expansion flags, or a body-size threshold that preserves full access without overwhelming the default workflow.

User value:
- keeps `show` useful for inspection instead of flooding the terminal with tens of kilobytes of body text
- preserves the new convenience of `show --name` even for very large symbols
- makes follow-up context more scannable in normal agent workflows

Observed motivation:
- downstream feedback explicitly called out `show --name MemoryStore` returning a roughly 57 KB class body, which is correct but ergonomically overwhelming
- the current retrieval loop is now good enough that giant `show` payloads are becoming the next practical friction point during inspection
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `show` now summarizes very large symbol bodies by default instead of printing the complete body unconditionally.
- Added `bodyPresentation` metadata with mode, truncation flag, and total/shown line and character counts.
- Added `--full` so agents can explicitly expand a large symbol body when they truly need all of it.
- Updated CLI help plus downstream adoption docs/snippets to explain the summary default and the `--full` escape hatch.

Verification
- `bun test` passes with 22 tests.
- Live `co-ma` check for `show --name MemoryStore` now returns `bodyPresentation.mode = "summary"` with a readable preview instead of a 50 KB+ default dump.
- Live `co-ma` check for `show --name MemoryStore --full` still returns the complete body.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
Large `show` results are now much easier to inspect by default. Symballist summarizes oversized bodies automatically, preserves explicit access to the complete body through `--full`, and tells callers exactly what representation they received.
<!-- SECTION:SUMMARY:END -->
