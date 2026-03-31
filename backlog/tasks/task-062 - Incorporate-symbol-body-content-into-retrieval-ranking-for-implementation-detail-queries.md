---
id: TASK-062
title: >-
  Incorporate symbol body content into retrieval ranking for
  implementation-detail queries
status: Done
assignee: []
created_date: '2026-03-31 13:04'
updated_date: '2026-03-31 13:43'
labels:
  - feature
  - feedback
  - retrieval
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opus feedback: implementation-detail queries often depend on terms that appear only in a function or method body, not the symbol name or signature. Explore body-aware lexical or hybrid ranking so queries about polling, progress, caching behavior, or inner logic surface the right implementation without falling back to grep.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 body-aware promotion stays scoped to non-doc implementation hits and does not regress the broader integration suite
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a narrow body-aware ranking slice in src/db.ts. computeMatchAnalysis now receives SearchOptions and uses conceptual terms, not raw stopword-heavy tokens, when checking whether a body, doc, or signature covers the decisive query terms. For broad conceptual code queries, non-doc parsed symbols whose required terms appear in the body but not in the signature or doc are promoted to a strong body_text match instead of staying a weak related token-overlap result.

Added a regression in tests/integration.test.ts where a natural-language implementation-detail query ("where does the pipeline poll for progress") must rank a code symbol above a competing markdown note because the decisive terms live inside the function body.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementation-detail queries now give real credit to body-only implementation matches. Broad conceptual code searches can promote the right function to a strong top result when the decisive terms appear in the body rather than the symbol name, while docs and generic body noise are still filtered by the narrower heuristic. Verified with bun test tests/integration.test.ts (59 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
