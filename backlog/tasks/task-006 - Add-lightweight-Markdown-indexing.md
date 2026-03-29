---
id: TASK-006
title: Add lightweight Markdown indexing
status: Done
assignee: []
created_date: '2026-03-28 15:55'
updated_date: '2026-03-28 15:58'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expand symballist indexing to cover Markdown so agent queries can hit repo docs, plans, and workflow notes in doc-heavy projects. Keep the first slice lightweight by indexing headings plus a file-level fallback record when no headings are present.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Markdown files are discovered and indexed without regressing current Python/HTML behavior.
- [x] #2 Query results can retrieve Markdown headings or file-level fallback content from fixture content.
- [x] #3 Status/config/readme reflect Markdown as a supported language.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added Markdown to supported language discovery and config, with a lightweight extractor that indexes ATX headings as heading symbols and falls back to a file record when no headings exist.

Expanded the fixture repo with workflow.md and updated integration coverage so status reports markdown support and querying backlog returns a Markdown heading hit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added lightweight Markdown indexing for docs coverage. Verified with bun test and a live fixture run: index picked up workflow.md and query backlog returned the Backlog Workflow heading with section text.
<!-- SECTION:FINAL_SUMMARY:END -->
