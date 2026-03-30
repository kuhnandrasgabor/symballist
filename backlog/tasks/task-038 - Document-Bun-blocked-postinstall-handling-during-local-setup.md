---
id: TASK-038
title: Document Bun blocked postinstall handling during local setup
status: Done
assignee: []
created_date: '2026-03-30 07:09'
updated_date: '2026-03-30 08:43'
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
- [x] #1 Docs explain whether the blocked postinstalls are required for a working local setup

Checked 6 installs across 7 packages (no changes) [4.00ms] on macOS
- [x] #2 Docs include the exact follow-up command or verification step users should run if trust is required
- [x] #3 README install/onboarding docs mention Bun blocked lifecycle scripts and that this can appear after bun install on macOS
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated README install guidance to explain Bun blocked lifecycle scripts, show `bun pm untrusted`, and provide the explicit `bun pm trust tree-sitter tree-sitter-html tree-sitter-python` follow-up for trusted local setup.
<!-- SECTION:FINAL_SUMMARY:END -->
