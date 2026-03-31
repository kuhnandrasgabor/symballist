---
id: TASK-059
title: >-
  Store full symbol bodies so lookup/show expansion is real for large code
  symbols
status: Done
assignee: []
created_date: '2026-03-31 12:23'
updated_date: '2026-03-31 12:55'
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
- [x] #1 Large real code symbols return bodyPresentation with fullerBodyAvailable when the default response is summarized.
- [x] #2 Re-running lookup/show with --full materially expands the returned body for large stored symbols rather than returning the same truncated preview.
- [x] #3 The fix is validated on a downstream real repo, not only synthetic tests.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed the real storage bug rather than the show layer. Python and JavaScript/TypeScript parsed symbols were only storing a short preview body at index time, which made bodyPresentation ineffective and caused --full to return the same truncated content. Updated those extractors to store the full parsed symbol body. Added a regression proving that a large but still parsed class now returns summarized output by default with fullerBodyAvailable true, and that rerunning show with --full materially expands the returned body.

2026-03-31 downstream retest after the storage fix still showed ~320-character bodies with bodyPresentation.fullerBodyAvailable false on large real Python symbols. That pattern strongly suggests the target repo is still serving an index built before the storage fix landed. Current indexing skips unchanged files, so storage-format changes do not retroactively refresh old symbol bodies unless the index is fully rebuilt.

2026-03-31 downstream validation after the index rebuild/versioning fix confirmed that bodyPresentation and --full now work correctly in a real repo. Large symbols now summarize by default with accurate total/shown line and char counts, fullerBodyAvailable true when appropriate, correct truncated flags, and a useful expansionHint. Example downstream validation: visualize_hierarchy_with_selection now reports 40 shown lines / 1898 chars by default versus 487 lines / 21657 chars with --full, and the previous ~320-character ceiling is gone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Parsed Python and JS/TS symbols now store full bodies, and index-format versioning plus rebuild support ensures existing repos refresh stale stored content. Downstream retest confirms the prior failure mode is gone: bodyPresentation is accurate, --full materially expands large symbols, and the old fixed ~320-character body cap no longer appears. Verified locally with bun test tests/integration.test.ts (57 pass, 0 fail) and downstream with a real-repo retest after rebuild.
<!-- SECTION:FINAL_SUMMARY:END -->
