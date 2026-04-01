---
id: TASK-084
title: >-
  Populate deterministic profile seed content for the remaining supported
  languages
status: Done
assignee: []
created_date: '2026-04-01 08:02'
updated_date: '2026-04-01 08:04'
labels:
  - ux
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the language-aware init/profile system introduced in TASK-082 and TASK-083 by adding visible deterministic profile source files for the remaining supported languages. Seed repo-local profile folders from those source assets, keep generated output stable, and ensure managed snippets and instructions stay scoped to enabled languages without regressing the current Ruby-first migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Source profile files exist for the remaining supported languages under profiles/<language>/ with agents, claude, instructions, and scope seed content.
- [ ] #2 Init seeds repo-local profile folders for enabled non-Ruby languages from the source assets instead of placeholder comments.
- [ ] #3 Generated repo-local instruction outputs remain deterministic and scoped to enabled languages.
- [ ] #4 Integration coverage verifies representative non-Ruby language profile seeding and output assembly.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add source profile folders for the remaining supported languages with minimal deterministic seed content.
2. Keep common shared guidance in the existing managed templates, but move language-specific notes into the source profile files.
3. Update or extend tests to verify non-Ruby profile seeding and enabled-language-specific output assembly.
4. Verify with integration tests and close the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added visible deterministic source profile folders for python, html, markdown, javascript, typescript, yaml, shell, dockerfile, and css under profiles/<language>/. Each now includes agents.md, claude.md, instructions.md, and scope.txt seed content so init can scaffold repo-local profiles from source assets instead of placeholder comments. Kept the non-Ruby snippets non-heading-heavy to avoid inflating generated instruction symbol counts while still making the files editable and language-specific.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the remaining language-profile seed migration on top of TASK-082 and TASK-083. Repo-local init now seeds deterministic profile content for all supported non-text languages from visible source assets under profiles/<language>/, and integration coverage verifies representative non-Ruby profile seeding and assembled output for auto-detected and explicit language lists. Verified with bun test tests/integration.test.ts (80 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
