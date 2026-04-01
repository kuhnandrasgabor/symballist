---
id: TASK-077
title: Deepen Ruby cross-file relation resolution beyond require-based heuristics
status: Done
assignee: []
created_date: '2026-03-31 20:24'
updated_date: '2026-03-31 20:43'
labels:
  - idea
  - ruby
dependencies: []
priority: high
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rails-style namespaced constant references resolve to repo-local Ruby files when the target path is obvious from available files
- [x] #2 Ruby symbols expose cross-file uses relations for resolved constant references without requiring explicit require statements
- [x] #3 Integration tests cover a cross-file Ruby namespace reference and relation surfacing through graph or related-symbol flows
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the Ruby indexer with Rails-style constant-to-path inference for obvious repo-local targets.
2. Emit cross-file uses relations from constant references and method calls that resolve through those inferred paths.
3. Add integration coverage and run the Ruby/integration test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added conservative Rails-style Ruby constant-to-path inference in src/indexer/ruby.ts so obvious repo-local constants can resolve without explicit require statements. Cross-file uses relations now surface for namespaced and unqualified constants when the target path is unambiguous, and db-side related-symbol resolution now understands :: labels when selecting target/source symbols.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed src/indexer/ruby.ts, src/db.ts, tests/integration.test.ts, README.md, and docs/agent-workflows/symballist-adoption.md. Added coverage for fully-qualified Ruby names and Rails-style cross-file constant relations surfacing through show/graph. Verified with bun test tests/integration.test.ts (72 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
