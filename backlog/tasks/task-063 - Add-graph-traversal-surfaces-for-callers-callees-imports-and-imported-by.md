---
id: TASK-063
title: Add graph traversal surfaces for callers callees imports and imported-by
status: Done
assignee: []
created_date: '2026-03-31 13:04'
updated_date: '2026-03-31 14:52'
labels:
  - feature
  - feedback
  - graph
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opus feedback: graph diagnostics are informative but not directly navigable. Add user-facing traversal commands or options so callers, callees, imports, imported-by, and related graph neighborhoods can be explored directly instead of only influencing ranking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI parsing help text and integration coverage validate the new graph surface end to end
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a new CLI traversal surface via src/commands/graph.ts and wired it through src/cli.ts as `symballist graph <id>` and `symballist graph --name <symbol>`. The command resolves a symbol and returns grouped graph neighbors: imports, uses, importedBy, usedBy, and containedIn.

In src/db.ts I added getGraphTraversalForSymbol plus inbound traversal resolution that can recover importedBy neighbors from file-level import edges by resolving likely symbols from the source file and imported target label. This keeps the command aligned with the lightweight graph already stored instead of inventing a second graph model.

Updated README.md and src/fs.ts so the command appears in the documented workflow and generated downstream guidance. Added integration coverage in tests/integration.test.ts for grouped traversal output, CLI parsing, and `graph --help`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Graph traversal is now a first-class user-facing surface. `symballist graph --name <symbol>` returns grouped outbound and inbound neighbors from the existing indexed graph, which turns graph diagnostics into direct navigation for imports, uses, importedBy, usedBy, and containment. Verified with bun test tests/integration.test.ts (61 pass, 0 fail) and bun run src/cli.ts graph --help.
<!-- SECTION:FINAL_SUMMARY:END -->
