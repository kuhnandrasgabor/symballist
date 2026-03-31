---
id: TASK-068
title: Reduce duplicate file noise in query result presentation
status: Done
assignee: []
created_date: '2026-03-31 13:04'
updated_date: '2026-03-31 17:44'
labels:
  - feature
  - feedback
  - ux
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opus feedback: result lists can feel noisy when several top hits come from the same file. Explore grouping, deduplicated file context, or compact presentation changes that reduce repetition while preserving symbol-level detail.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a query-only result-presentation improvement that reduces repeated same-file noise without removing symbol detail. query now fetches a wider candidate pool, round-robins repeated files after preserving the top hit, and returns fileGroups summarizing how the final symbol hits cluster by file. Updated CLI/help/docs wording accordingly and added an integration regression proving repeated same-file hits no longer monopolize the top query window when another relevant file is nearby.
<!-- SECTION:FINAL_SUMMARY:END -->
