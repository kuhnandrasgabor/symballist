---
id: TASK-008
title: Add downstream instruction snippets for symballist adoption
status: Done
assignee: []
created_date: '2026-03-28 16:23'
updated_date: '2026-03-28 16:24'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add dedicated snippet files for downstream AGENTS.md and CLAUDE.md integration so symballist adoption guidance does not rely on this repo's own instruction files as examples. Update the shared adoption workflow to point at the snippets as the canonical copy-paste source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dedicated snippet files exist for downstream AGENTS.md and CLAUDE.md integration.
- [x] #2 The shared adoption workflow points to the snippet files as the canonical copy-paste source.
- [x] #3 README or related docs mention the snippet location so it is easy to find.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added dedicated downstream snippet files for AGENTS.md and CLAUDE.md adoption so reusable integration text lives outside this repo's own instruction files.

Updated the shared adoption workflow to point at the snippet files as the canonical copy-paste source, and updated the README so the snippet locations are easy to find.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated reusable downstream symballist instructions into dedicated snippet files under docs/snippets and linked them from the shared adoption workflow and README.
<!-- SECTION:FINAL_SUMMARY:END -->
