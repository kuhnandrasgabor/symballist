---
id: TASK-076
title: Fix fully-qualified Ruby symbol resolution for lookup/show/graph
status: Done
assignee: []
created_date: '2026-03-31 20:24'
updated_date: '2026-03-31 20:32'
labels:
  - bug
  - ruby
dependencies: []
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed exact-name resolution for fully-qualified Ruby identifiers in lookup/show/graph by admitting normalized signature-suffix matches such as Scoring::SubmitParts against stored signatures like class Scoring::SubmitParts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated src/db.ts and tests/integration.test.ts so lookup, show, and graph resolve fully-qualified Ruby names. Verified with bun test tests/integration.test.ts and the full integration suite (71 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
