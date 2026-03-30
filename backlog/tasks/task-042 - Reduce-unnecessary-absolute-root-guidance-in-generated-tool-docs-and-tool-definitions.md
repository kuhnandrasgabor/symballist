---
id: TASK-042
title: >-
  Reduce unnecessary absolute-root guidance in generated tool docs and tool
  definitions
status: To Do
assignee: []
created_date: '2026-03-30 07:36'
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
- [ ] #1 Generated guidance docs distinguish between linked-global usage and repo-local wrapper fallback
- [ ] #2 Tool-definition manifests avoid unnecessary absolute-root or placeholder-heavy command templates when a simpler invocation is sufficient
- [ ] #3 Any remaining explicit wrapper or --root guidance is justified by actual runtime/tooling requirements rather than used by default
<!-- AC:END -->
