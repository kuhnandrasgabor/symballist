---
id: TASK-083
title: >-
  Populate language profile content and migrate managed instruction text into
  repo-local profiles
status: Done
assignee: []
created_date: '2026-04-01 07:35'
updated_date: '2026-04-01 07:56'
labels:
  - global
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow the language-aware init backbone by moving existing language-specific guidance out of hardcoded fs.ts template strings into deterministic profile content files, starting with shared/general content plus Ruby-specific guidance and then the remaining supported languages. Keep generated output stable while reducing monolithic hardcoded snippet text.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add deterministic profile seed files in this repo for shared and Ruby-specific guidance.
2. Update init/profile scaffolding to seed repo-local profile files from those source assets instead of placeholder comments.
3. Remove duplicated hardcoded language-specific prose from fs.ts where the seeded profiles now cover it, while preserving output stability.
4. Add tests around seeded profile content and generated managed instructions, then verify and close.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the first real profile-content migration slice on top of TASK-082. Added deterministic repo source seed files under profiles/ruby/ for agents.md, claude.md, instructions.md, and scope.txt; init now seeds repo-local profile files from those source assets instead of placeholder comments. Managed instruction rendering now reflects the enabled language list dynamically and appends Ruby-specific caveats from the seeded profile files rather than duplicating them in fs.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated the first language-specific content out of hardcoded fs.ts snippet strings into deterministic profile source files, starting with Ruby. Repo-local init now seeds profile files from visible source assets, generated managed snippets show only enabled language coverage, and Ruby-specific caveats come from profile content instead of monolithic inline strings. Verified with bun test tests/integration.test.ts (80 pass, 0 fail) and bun run src/cli.ts init --help.
<!-- SECTION:FINAL_SUMMARY:END -->
