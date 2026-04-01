---
id: TASK-086
title: Define a cross-language oversized-file extraction and recovery policy
status: Done
assignee: []
created_date: '2026-04-01 12:46'
updated_date: '2026-04-01 12:56'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Symballist now has two concrete oversized-file recovery implementations: Python large-file symbol recovery (TASK-002) and JavaScript oversized-script recovery for large frontend modules. This should be treated as an emerging cross-language architecture rather than a sequence of isolated band-aids. Define the generic policy layer for when files exceed safe parser limits, how recovery vs fallback is chosen, how extraction trust is reported, and which language-specific adapters exist or are still missing.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Defined a shared oversized-file extraction policy layer via src/indexer/oversized.ts. Standardized parsed/recovered/fallback semantics and shared safe parser limit strings across Python, JavaScript/TypeScript, HTML, and Ruby. Documented that Python and JavaScript/TypeScript currently have recovery adapters, while HTML and Ruby remain fallback-only when oversized. Verification: bun test tests/integration.test.ts (82 pass, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a shared oversized-file policy helper and standardized parsed/recovered/fallback semantics across indexers. Python and JavaScript/TypeScript are now explicitly documented as recovery-capable; HTML and Ruby remain fallback-only when oversized.
<!-- SECTION:FINAL_SUMMARY:END -->
