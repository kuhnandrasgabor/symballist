---
id: TASK-036
title: >-
  Improve shell-aware onboarding and first-run invocation guidance for
  symballist
status: Done
assignee: []
created_date: '2026-03-29 19:27'
updated_date: '2026-03-29 19:34'
labels:
  - ux
  - onboarding
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make first-run use of symballist more reliable in fresh sessions, especially for agents starting in bash-like shells on Windows. Add shell-aware wrapper guidance to init-generated instructions and docs, surface the best local entrypoint for the current shell, and reduce trial-and-error around whether to use .cmd, PowerShell, or POSIX wrappers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `init` guidance clearly distinguishes between PowerShell/cmd and bash-like local wrapper entrypoints.
- [x] #2 `status` exposes shell-aware local entrypoint guidance in machine-readable output.
- [x] #3 README, adoption docs, and downstream snippet docs reflect the shell-aware fallback guidance.
- [x] #4 Tests cover shell detection and the new guidance surface.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added `src/shell.ts` with shell detection and a shell-aware local entrypoint helper.
- `status` now returns a `shellGuidance` block with the recommended local wrapper plus alternatives.
- `init` now prints setup type plus a shell-appropriate quick start instead of only logging that initialization finished.
- Managed AGENTS/CLAUDE snippets now mention both PowerShell/cmd and bash/zsh/sh fallback wrappers.
- README and adoption docs now explain the shell-specific wrapper choice more directly so fresh sessions do not default to the wrong entrypoint.
<!-- SECTION:NOTES:END -->
