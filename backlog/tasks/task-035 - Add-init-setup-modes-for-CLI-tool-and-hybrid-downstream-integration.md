---
id: TASK-035
title: 'Add init setup modes for CLI, tool, and hybrid downstream integration'
status: Done
assignee: []
created_date: '2026-03-29 18:29'
updated_date: '2026-03-29 18:49'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a setup-type option to symballist init so downstream repos can choose CLI-only guidance, tool-first guidance, or a hybrid setup. Keep CLI wrappers as the robust fallback, default to hybrid, persist the selected mode in repo-local config, and make init bootstrap the appropriate instructions/assets without forcing one integration style on every repo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `symballist init` accepts a setup-type selector for `cli`, `tool`, and `hybrid`.
- [x] #2 The chosen setup type is persisted in repo-local config and reused on subsequent init runs unless explicitly overridden.
- [x] #3 `hybrid` is the default and generates repo-local tool-definition assets plus CLI fallback wrappers.
- [x] #4 Managed `AGENTS.md` / `CLAUDE.md` guidance changes shape based on the selected setup type.
- [x] #5 Tests cover default hybrid, explicit cli-only, and explicit tool-first setup behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added `setupType` to repo-local config and made `hybrid` the default.
- Extended `symballist init` with `--setup-type cli|tool|hybrid`.
- `init` now generates `.symballist/tools/symballist-tools.json` plus `.symballist/tools/README.md` for `tool` and `hybrid` setups.
- Managed `AGENTS.md` / `CLAUDE.md` blocks are now rendered per setup type instead of always injecting the same CLI-heavy guidance.
- `cli` setup removes generated tool-definition assets and keeps the integration wrapper-only.
- Updated README, adoption workflow docs, and downstream snippet docs so the public docs match the generated setup behavior.
<!-- SECTION:NOTES:END -->
