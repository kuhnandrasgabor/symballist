---
id: TASK-038
title: Document Bun blocked postinstall handling during local setup
status: To Do
assignee: []
created_date: '2026-03-30 07:09'
updated_date: '2026-03-30 07:09'
labels:
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Manual macOS onboarding from README hits a confusing Bun message after `bun install`: Bun blocks lifecycle scripts for `tree-sitter-html` and `tree-sitter-python` and only prints a brief note about `bun pm untrusted`. The install section should explain whether this is expected, when the user needs to trust/run those scripts, and what command to use.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Docs explain whether the blocked postinstalls are required for a working local setup

Checked 6 installs across 7 packages (no changes) [4.00ms] on macOS
- [ ] #2 Docs include the exact follow-up command or verification step users should run if trust is required
- [ ] #3 README install/onboarding docs mention Bun blocked lifecycle scripts and that this can appear after bun install on macOS
<!-- AC:END -->
