---
id: TASK-078
title: Align show CLI with lookup by accepting a positional symbol name
status: Done
assignee: []
created_date: '2026-04-01 06:11'
updated_date: '2026-04-01 06:32'
labels:
  - bug
  - ux
  - cli
  - global
  - any-scale
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make `symballist show "Name"` work as an intuitive fast path, or otherwise align the CLI surface so `show` and `lookup` do not diverge on basic symbol-name invocation. The current positional-id-only behavior produces confusing errors for first-time users.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 resolves the same symbol as  when no numeric id is supplied
- [x] #2 Invalid positional ids still produce clear errors without ambiguity
- [x] #3 CLI help reflects the accepted positional-name behavior or the revised aligned contract
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated CLI parsing so `show` treats a non-numeric positional argument as a symbol name shorthand for `--name`, while preserving numeric positional ids. Also updated help text to advertise `show <id|symbol>` explicitly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed src/cli.ts and tests/integration.test.ts. `symballist show greet` now behaves like `symballist show --name greet`, numeric ids still work as before, and CLI help now reflects the aligned contract. Verified with bun test tests/integration.test.ts (74 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
