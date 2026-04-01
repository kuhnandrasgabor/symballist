---
id: DRAFT-034
title: Add language-aware init profiles and auto-detection for repo-local guidance
status: Draft
assignee: []
created_date: '2026-04-01 07:16'
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

Why this matters:
- reduces token cost by excluding irrelevant language guidance
- makes the generated instructions easier to inspect and edit
- gives users a deterministic, debuggable setup model
- leaves room for later optional guided onboarding without making normal `init` depend on an LLM

Recommended next action:
- define the profile folder contract first
- decide where the enabled language list lives in config
- keep detection file- and marker-based in the first slice
- treat any later LLM-assisted onboarding as an optional follow-up, not the foundation
<!-- SECTION:DESCRIPTION:END -->
