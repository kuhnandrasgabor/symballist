---
id: TASK-049
title: Improve Dockerfile instruction extraction and retrieval quality
status: Done
assignee: []
created_date: '2026-03-31 06:23'
updated_date: '2026-03-31 06:23'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream retesting after TASK-043 and TASK-048 confirmed that path propagation, shell startup indexing, and CSS lookup for real .css files are improved. A remaining gap was Dockerfile concept retrieval: queries framed around Dockerfile instructions such as COPY, RUN, FROM, requirements installation, or base-image setup still tended to return unrelated Python results. Tighten Dockerfile indexing and ranking so instruction-oriented queries surface Dockerfile results more reliably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dockerfile instruction-oriented queries return Dockerfile results reliably in integration coverage
- [x] #2 Dockerfile indexing includes enough standalone and instruction-level structure to support FROM/RUN/COPY style retrieval
- [x] #3 Tests verify the improved retrieval while keeping the scope limited to actual Dockerfile content
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a full-body standalone Dockerfile file record so file-level retrieval can match across the actual instruction content instead of a short truncated prefix.
Added instruction-level Dockerfile symbols for generic instruction lines such as FROM, RUN, COPY, and WORKDIR, while preserving existing stage and ARG/ENV extraction.
Added a Dockerfile-specific query bias for instruction-oriented queries so real Dockerfile rows are not drowned out by unrelated code hits when terms like COPY, RUN, FROM, requirements, pip, image, or mkdir appear together.
Expanded integration coverage to assert direct Dockerfile lookup, stage retrieval, and instruction-oriented query retrieval, with scope limited to actual Dockerfile content.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Symballist now extracts Dockerfile instruction-level records and ranks Dockerfile content more appropriately for instruction-oriented queries like COPY/RUN/FROM and requirements-install flows.
Verified with `bun test` on 2026-03-31: 46 pass, 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
