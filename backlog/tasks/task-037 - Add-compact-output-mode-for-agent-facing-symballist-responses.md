---
id: TASK-037
title: Add compact output mode for agent-facing symballist responses
status: Done
assignee: []
created_date: '2026-03-29 22:03'
updated_date: '2026-03-29 22:10'
labels:
  - ux
  - agent-experience
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a compact response mode for query, lookup, and show that preserves the core retrieval payload while trimming repeated static explanation blocks such as result semantics, trust semantics, and verbose embedding diagnostics. Keep the current verbose output available, but let agent consumers request a much cheaper response shape explicitly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `query`, `lookup`, and `show` accept an explicit compact-response flag.
- [x] #2 Compact mode preserves the core retrieval payload but omits repeated legend and trust-explanation blocks.
- [x] #3 Default verbose output remains unchanged for existing callers.
- [x] #4 Tests cover CLI parsing and compact payload behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added `--compact` support to `query`, `lookup`, and `show`.
- Compact mode keeps retrieval results, trust fields, bodyPresentation, relations, and alternatives, but omits repeated `resultSemantics` / `trustSemantics` blocks.
- Updated README and the shared adoption workflow to recommend `--compact` for agent-oriented consumption where repeated legend blocks are unnecessary.
- Reran `init` so the generated local guidance reflects the new compact-mode recommendation.
<!-- SECTION:NOTES:END -->
