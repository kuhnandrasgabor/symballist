---
id: TASK-089
title: Expose extraction-mode counts in status output
status: Done
assignee: []
created_date: '2026-04-01 13:05'
updated_date: '2026-04-01 13:07'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add parsed/recovered/fallback extraction counts to status, including a per-language breakdown, so large-repo users can see how much of the index relies on oversized-file recovery or file-level fallbacks.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added extractionSummary to status output with parsed/recovered/fallback totals plus a per-language breakdown. This makes oversized-file recovery and fallback reliance visible without manual DB inspection. Verification: bun test tests/integration.test.ts (83 pass, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Status now exposes parsed/recovered/fallback extraction counts, including a per-language breakdown, so large repos can see how much the oversized-file strategy is carrying.
<!-- SECTION:FINAL_SUMMARY:END -->
