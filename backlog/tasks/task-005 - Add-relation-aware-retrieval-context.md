---
id: TASK-005
title: Add relation-aware retrieval context
status: Done
assignee: []
created_date: '2026-03-28 14:41'
updated_date: '2026-03-28 14:44'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the new lightweight relations to expose related symbol context in retrieval output without introducing a full graph engine. The first slice should let agents follow import/containment links from a symbol into a small set of related symbols.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Show can surface related symbols derived from lightweight relations.
- [x] #2 The implementation remains lightweight and bounded, with a small related-symbol limit and no recursive traversal.
- [x] #3 Integration coverage proves related symbols can be retrieved from fixture content.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added bounded relation-aware lookup helpers so show can resolve lightweight relations into concrete symbols without recursion. Import relations prefer exact target-name matches in the resolved target file, while containment relations return the nearest enclosing symbol in the same file.

Extended integration coverage and verified the fixture path live: show for greet now returns Greeter via contained_in and slugify via imports.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added relation-aware retrieval context to show output through a new related array. Verified with bun test and a fixture run against mini-py-html.
<!-- SECTION:FINAL_SUMMARY:END -->
