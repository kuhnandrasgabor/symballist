---
id: TASK-059
title: >-
  Store full symbol bodies so lookup/show expansion is real for large code
  symbols
status: To Do
assignee: []
created_date: '2026-03-31 12:23'
labels:
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream retesting found that bodyPresentation signaling is effectively absent for large real code symbols because the stored symbol body is already truncated at index time. In the reported case, a 234-line EmbeddingService class returned a 319-character body and --full returned the same 319 characters. This means lookup/show bodyPresentation and --full can only work honestly when the full body was stored in the first place. Rework symbol body storage so large code symbols retain enough full content for lookup/show expansion to be real, while still keeping snippets and embedding payloads bounded where needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Large real code symbols return bodyPresentation with fullerBodyAvailable when the default response is summarized.
- [ ] #2 Re-running lookup/show with --full materially expands the returned body for large stored symbols rather than returning the same truncated preview.
- [ ] #3 The fix is validated on a downstream real repo, not only synthetic tests.
<!-- AC:END -->
