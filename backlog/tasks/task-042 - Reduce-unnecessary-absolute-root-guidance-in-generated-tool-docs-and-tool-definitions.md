---
id: TASK-042
title: >-
  Reduce unnecessary absolute-root guidance in generated tool docs and tool
  definitions
status: Done
assignee: []
created_date: '2026-03-30 07:36'
updated_date: '2026-03-30 08:43'
labels:
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Manual onboarding feedback shows that the generated symballist guidance and tool-definition assets still lean heavily on repo-local wrapper commands plus `--root <PROJECT_ROOT>` placeholders and absolute-root style usage. When `bun link` has been used, much of this guidance is more verbose than necessary. Rework the generated guidance docs and tool-definition templates so they prefer the simplest valid invocation style, while keeping explicit wrapper/`--root` forms only where they are actually required for portability or runtime constraints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Generated guidance docs distinguish between linked-global usage and repo-local wrapper fallback
- [x] #2 Tool-definition manifests avoid unnecessary absolute-root or placeholder-heavy command templates when a simpler invocation is sufficient
- [x] #3 Any remaining explicit wrapper or --root guidance is justified by actual runtime/tooling requirements rather than used by default
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated generated AGENTS/CLAUDE snippets, tool docs, init guidance, and tool-definition command templates to prefer simpler repo-root usage and linked-global manual fallbacks, while retaining explicit wrapper and `--root` guidance only as fallback for portability or non-repo-root invocation.
<!-- SECTION:FINAL_SUMMARY:END -->
