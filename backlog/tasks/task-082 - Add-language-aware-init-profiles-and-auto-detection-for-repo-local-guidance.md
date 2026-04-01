---
id: TASK-082
title: Add language-aware init profiles and auto-detection for repo-local guidance
status: Done
assignee: []
created_date: '2026-04-01 07:16'
updated_date: '2026-04-01 07:35'
labels:
  - idea
  - setup
  - docs
  - global
  - any-scale
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore a deterministic setup flow where `init --languages auto` performs a fast repo scan for supported language signals, stores the resolved enabled-language list in config, and renders only the relevant language-specific guidance and setup snippets.

Preferred product shape:
- keep the base instruction system transparent and file-driven
- store language-specific setup assets in visible repo files/folders rather than hidden prompt assembly logic
- make the assembled guidance deterministic from the detected or explicitly configured language list

One possible structure:
- `profiles/<language>/detection.txt`
  - simple marker rules or human-readable detection notes for that language
- `profiles/<language>/agents.md`
  - content appended into managed `AGENTS.md` blocks when that language is enabled
- `profiles/<language>/instructions.md`
  - content used for repo-local adoption/instruction output
- `profiles/<language>/scope.txt`
  - recommended default scope hints for that language or ecosystem

The implementation model should stay simple:
- `init --languages auto` runs a quick file/marker scan and resolves a supported language list
- `init --languages ruby,typescript` or manual config edits override the auto-detected list
- config becomes the durable source of truth for enabled language profiles
- instruction rendering appends the general shared guidance plus only the enabled language profile snippets
- generated guidance should explicitly tell agents that the repo-local scope and language-profile-derived files are editable when they need to tune setup for the current project

Why this matters:
- reduces token cost by excluding irrelevant language guidance
- makes the generated instructions easier to inspect and edit
- gives users a deterministic, debuggable setup model
- leaves room for later optional guided onboarding without making normal `init` depend on an LLM
- still gives downstream agents a sanctioned path to refine `scope.txt` or other repo-local setup files when the project clearly needs custom scoping

Recommended next action:
- define the profile folder contract first
- decide where the enabled language list lives in config
- keep detection file- and marker-based in the first slice
- treat any later LLM-assisted onboarding as an optional follow-up, not the foundation
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add init language-selection parsing and deterministic repo auto-detection.
2. Store enabled languages in config and scaffold repo-local profile folders for those languages.
3. Make managed instruction rendering append enabled language profile files while preserving current built-in prose as fallback.
4. Add tests for parser/init/profile scaffolding, then verify and leave full profile-content migration for a follow-up pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the framework slice only. Added init language selection parsing (`--languages auto|...`), fast repo language auto-detection, enabled-language persistence in config, repo-local profile scaffolding under `.symballist/profiles/<language>/`, and template assembly hooks that can append enabled language profile files while preserving current built-in snippet text as fallback. Added parser/init/profile tests and minimal README/adoption doc updates. Left full profile-content migration for a follow-up draft.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the first-turn backbone for language-aware init. `symballist init` now supports `--languages auto|python,ruby,...`, records enabled languages in config, scaffolds matching repo-local profile folders, and keeps managed instruction rendering deterministic with language-profile append hooks. Current built-in prose remains the fallback until profile-content migration lands. Verified with `bun test tests/integration.test.ts` (80 pass, 0 fail) and `bun run src/cli.ts init --help`. Follow-up draft created for migrating actual language profile content.
<!-- SECTION:FINAL_SUMMARY:END -->
