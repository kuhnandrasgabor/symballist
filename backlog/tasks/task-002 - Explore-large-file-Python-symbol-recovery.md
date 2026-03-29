---
id: TASK-002
title: Explore large-file Python symbol recovery
status: Done
assignee:
  - '@Codex'
created_date: '2026-03-28 14:20'
updated_date: '2026-03-28 14:29'
labels:
  - spike
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recover useful Python symbols from oversized files that currently exceed the safe tree-sitter runtime limit and collapse into a single file-level fallback record. This work should preserve the current reliable fallback path while extracting enough top-level structure from large files to surface real definitions such as AgentConfig in co-ma and improve downstream query relevance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Oversized Python files produce more than a single file-level fallback when a lightweight top-level symbol recovery path is available.
- [x] #2 Recovered symbols from oversized files include accurate enough names, kinds, and spans to participate in query and show results.
- [x] #3 The co-ma AgentConfig case is revalidated after the change and the true definition becomes discoverable if it exists in indexed oversized Python sources.
- [x] #4 Existing behavior for normal-sized Python files, HTML files, and hard parse failures remains stable with test coverage.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Mark TASK-002 In Progress and implement a lightweight oversized-file Python recovery path that scans source text for top-level classes, functions, and imports when tree-sitter is skipped for size reasons.
2. Preserve the current reliable file-level fallback by using it only when the oversized-file scan finds no usable symbols or encounters obviously broken structure.
3. Add focused integration coverage with a synthetic oversized Python fixture that proves recovered symbols have usable names, kinds, spans, query hits, and show output.
4. Reindex and revalidate the live co-ma AgentConfig case to confirm the true definition becomes discoverable if it lives in an oversized Python source file.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a lightweight oversized-file Python recovery path that scans top-level imports, classes, and functions instead of collapsing large files into a single file fallback.

Added integration coverage proving oversized Python files yield recovered symbols with usable spans, query hits, and show output.

Bumped the schema/index version so existing local indexes rebuild once and pick up the new oversized-file recovery behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented oversized-file Python symbol recovery by adding a lightweight top-level scanner for classes, functions, and imports when tree-sitter is skipped for size reasons. This preserved the file-level fallback as a safety net while making large Python sources contribute usable symbol records with spans and show/query support. Validation included a synthetic oversized-file integration test plus a live reindex of D:\Projects\co-ma, where AgentConfig in src\coma\config\models.py became the top query result after the schema-version rebuild.
<!-- SECTION:FINAL_SUMMARY:END -->
