---
id: TASK-041
title: Rework README quickstart to prioritize linked global symballist usage
status: To Do
assignee: []
created_date: '2026-03-30 07:24'
updated_date: '2026-03-30 07:31'
labels:
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Manual onboarding on macOS showed that after running `bun link`, downstream usage becomes much simpler than the README currently suggests. The README and quickstart sections currently emphasize `--root <PROJECT_ROOT>` examples and repo-local wrapper paths, which makes the first-use story feel more path-heavy than necessary. Rework the docs so the linked global command flow is the primary happy path when `bun link` has been used, while still documenting the explicit `--root` and repo-local wrapper forms as fallback/reference guidance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README install/quickstart sections clearly distinguish the linked global command flow from the repo-local wrapper flow
- [ ] #2 The more explicit path-heavy and --root-based forms remain documented as fallback/reference guidance
- [ ] #3 The primary quickstart examples use the simpler linked command style when bun link has been completed
- [ ] #4 Quickstart/onboarding docs tell users when setup is effectively complete and suggest an optional watch loop for active development
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Additional onboarding feedback from manual macOS run:
- Move the Project Management section later in the README instead of placing it before target-repo setup.
- After successful init/index/status, docs should say the user is effectively done unless they are actively developing.
- Suggest an optional foreground watch loop for active work, around a 2-5 second interval, as the low-friction keep-fresh path once tools/skills are wired up.
- Positive signal: lookup and status both behaved well in the target repo during manual testing.
<!-- SECTION:NOTES:END -->
