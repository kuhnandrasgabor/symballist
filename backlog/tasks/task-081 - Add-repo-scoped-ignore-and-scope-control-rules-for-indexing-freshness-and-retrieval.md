---
id: TASK-081
title: >-
  Add repo-scoped ignore and scope-control rules for indexing, freshness, and
  retrieval
status: Done
assignee: []
created_date: '2026-04-01 05:27'
updated_date: '2026-04-01 06:58'
labels:
  - idea
  - spike
  - decision
  - indexing
  - freshness
  - retrieval
  - setup
  - global
  - large-repo
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request: give Symballist a system-level way to define repo scope so projects can explicitly exclude directories or files from indexing, freshness, and default retrieval. This should be the main answer for generated code, binaries, vendor zones, third-party bundles, submodules, and other noisy repo-specific areas rather than hardcoded ranking exceptions.

Current code context: query and lookup already support retrieval-time `--exclude-path` filtering, but `src/fs.ts:listSourceFiles` still traverses and considers the whole supported tree, and `src/freshness.ts` uses the same scan for stale detection. There is currently no persistent repo-scoped ignore layer for search scope.

Recommended product shape:
- Use a dedicated repo-local ignore driver file as the primary explicit control surface.
- Let that file define default scope for indexing, freshness, and retrieval.
- Keep room for per-command overrides when a user intentionally wants ignored paths back.
- Keep the first slice human-authored and documented rather than trying to infer the right rules automatically.

Possible later follow-up:
- an extended `init` or guided onboarding flow that helps assemble the ignore driver file for a repo
- this could be LLM-assisted, but should stay optional and sit on top of a simple editable file rather than replace it

Decisions to compare:
- Use only a dedicated `.symballist` ignore/scope file.
- Optionally merge `.gitignore` with repo-local Symballist rules using explicit precedence.
- Decide whether ignored paths should be excluded only from indexing or also from freshness reporting and default query surfaces.
- Decide how ignore-rule changes trigger refresh, reindex, or rebuild behavior.

Tradeoffs to evaluate:
- User surprise if `.gitignore` hides source files they still expect to search.
- Portability and documentation burden of a new ignore format.
- Need for reindex/rebuild behavior when ignore rules change.
- Interaction with existing retrieval-time `--exclude-path` flags, which solve a different problem.
- How much setup help `init` should provide before the first index run.

Recommended next action: define the ignore driver file semantics first, prototype repo-scoped scope control as the default system behavior, and treat vendored submodule noise or Ruby-specific vendor layouts as consumers of this mechanism rather than product hardcoding. Evaluate optional guided onboarding only after the base file-driven model is clear.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a repo-local scope file under .symballist and load it during init/read-config flows.
2. Apply scope rules to source discovery and freshness so indexing/status/watch share the same in-scope view.
3. Surface scope configuration in status and document the behavior, overrides, and rebuild expectations.
4. Add integration coverage for scope-aware indexing and freshness behavior, then verify with tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the first file-driven repo scope-control slice. Added .symballist/scope.txt bootstrap plus repo-scope parsing in fs.ts, applied those rules to source discovery and freshness, stored the indexed scope signature in metadata, and surfaced scope control plus scopeChanged freshness in status/query/show/graph/watch flows. Added integration coverage for scoped discovery/status and stale-on-scope-change watch behavior, and updated README/adoption/help text to document the new mechanism and its refresh expectations.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added repo-scoped ignore and scope-control rules via .symballist/scope.txt and wired them through indexing, freshness, status, watch, and retrieval freshness surfaces. Scope edits now mark the index stale until reapplied, and status exposes the active rules plus indexed/current scope signatures. Updated README, adoption docs, CLI help, and generated snippet source text. Verified with bun test tests/integration.test.ts (77 pass, 0 fail) and bun run src/cli.ts status --help.
<!-- SECTION:FINAL_SUMMARY:END -->
