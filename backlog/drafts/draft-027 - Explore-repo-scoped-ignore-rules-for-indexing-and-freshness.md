---
id: DRAFT-027
title: Add repo-scoped ignore and scope-control rules for indexing, freshness, and retrieval
status: Draft
assignee: []
created_date: '2026-04-01 05:27'
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
