---
id: TASK-054
title: Improve agent-oriented show body defaults and expansion behavior
status: Done
assignee: []
created_date: '2026-03-31 07:12'
updated_date: '2026-03-31 07:15'
labels:
  - ux
  - agent-experience
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Show truncation is honest but can still cost an extra round-trip for agent workflows. Improve agent-oriented body expansion behavior by making summarized bodies signal more clearly when full output would change the response, and carry that signaling through lookup/show payloads and guidance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Lookup/show body presentation explicitly signals when full output would materially expand the body
- [x] #2 Docs or help text explain the summarized default and the role of --full more clearly
- [x] #3 Integration coverage proves the new body-presentation signaling is present for summarized outputs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended bodyPresentation with fullerBodyAvailable and expansionHint so lookup/show responses explicitly say when --full would materially expand the body. Updated docs/help to explain the summarized default more clearly and added integration coverage for summarized lookup/show payloads.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Lookup and show now signal summarized-body expansion more explicitly. bodyPresentation tells downstream consumers whether a fuller body is available and includes a direct expansion hint, while the docs and CLI help explain the summarized default and when --full is worth using. Verified with bun test (49 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
