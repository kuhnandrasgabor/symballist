---
id: TASK-012
title: Improve Windows invocation UX and ship a real symballist command
status: Done
assignee: []
created_date: '2026-03-28 16:47'
updated_date: '2026-03-28 17:19'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One agent hit a rough first-use issue on Windows: bun run with a backslash-heavy absolute path was easy to get wrong and failed poorly. This is not really a retrieval-quality issue; it is an adoption and ergonomics issue. Symballist would be easier to use across repos if agents could call a stable command name instead of remembering bun run <absolute-path> quirks.

Capture a draft for packaging and invocation polish on Windows and cross-repo use. The likely direction is to expose a first-class symballist command or wrapper with friendlier error messages for bad invocation forms.

User value:
- reduces first-call failure and onboarding friction
- makes downstream AGENTS.md / CLAUDE.md instructions shorter and more robust
- improves adoption by making symballist feel like a real tool rather than an internal script path

Observed motivation:
- agent explicitly reported bun run D:\Projects\symballist\src\cli.ts as a rough first-call failure with backslashes
- we have now started bootstrapping symballist into other repos, so invocation quality matters more than before
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 init bootstraps a stable local wrapper command under .symballist/bin for downstream repos.
- [x] #2 Generated adoption instructions prefer the local wrapper command instead of fragile bun run absolute-path invocations.
- [x] #3 The package exposes a real symballist bin entry and regression coverage verifies the wrapper/bootstrap behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a package bin entry for symballist and taught init to generate local wrapper commands under .symballist/bin, including a Windows .cmd wrapper plus PowerShell and POSIX variants.

Updated downstream snippets and the shared adoption workflow so agents prefer the repo-local .symballist\\bin\\symballist.cmd entrypoint after init, with the global symballist command as an optional linked/installable path.

Expanded integration coverage to verify wrapper files are created and that generated managed instructions reference the local wrapper. Also manually smoke-tested .symballist\\bin\\symballist.cmd status in this repo.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped a more tool-like invocation path for downstream projects by combining a real package bin entry with init-time local wrapper scripts. Verified with bun test (13 passing) and a live local wrapper status run.
<!-- SECTION:FINAL_SUMMARY:END -->
