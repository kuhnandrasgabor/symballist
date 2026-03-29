---
id: TASK-006
title: Add lightweight Markdown indexing
status: To Do
assignee: []
created_date: '2026-03-28 15:55'
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
- [ ] #1 Markdown files are discovered and indexed without regressing current Python/HTML behavior.
- [ ] #2 Query results can retrieve Markdown headings or file-level fallback content from fixture content.
- [ ] #3 Status/config/readme reflect Markdown as a supported language.
<!-- AC:END -->
