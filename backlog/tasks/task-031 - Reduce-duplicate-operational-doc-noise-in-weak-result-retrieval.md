---
id: TASK-031
title: Reduce duplicate operational-doc noise in weak-result retrieval
status: Done
assignee: []
created_date: '2026-03-29 15:42'
updated_date: '2026-03-29 16:19'
labels:
  - idea
  - spike
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback summary
- Agent testing showed that weak or low-signal queries can still bubble AGENTS.md, CLAUDE.md, or other operational mirrors above more useful canonical docs after the primary target disappears.
- This is much better in docs-only mode than before, but still noticeable for weak-result cases and deleted-probe cleanup tests.

Why it matters
- When the result set is already weak, duplicated operational docs make the tail feel noisy and reduce confidence in the ranking.
- This is especially visible when users are trying to verify that a deleted marker is truly gone and the fallback noise becomes the main output.

Suggested direction
- Extend canonical-doc preference and duplicate suppression beyond strict docs-only mode into weak-result handling.
- Consider collapsing or demoting mirrored operational docs when their content is near-duplicate and the query signal is low.
- Preserve useful instruction docs when explicitly targeted, but keep them from crowding broad or weak-result searches by default.

Expected outcome
- Low-signal or no-longer-present queries degrade more gracefully, with less duplicated operational-document noise.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reduced weak-result operational-doc noise by adding a narrow weak-signal penalty for mirrored operational markdown files and collapsing duplicate operational mirror results before final slicing. Added regression coverage for low-signal duplicate suppression; bun test now passes with 37 tests.
<!-- SECTION:FINAL_SUMMARY:END -->
