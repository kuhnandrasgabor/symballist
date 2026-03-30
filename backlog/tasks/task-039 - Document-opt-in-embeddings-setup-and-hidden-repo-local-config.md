---
id: TASK-039
title: Document opt-in embeddings setup and hidden repo-local config
status: Done
assignee: []
created_date: '2026-03-30 07:20'
updated_date: '2026-03-30 08:43'
labels:
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Manual onboarding showed that `symballist init` works and only patches tracked files such as `.gitignore`, `AGENTS.md`, and `CLAUDE.md`, while the actionable embeddings config lives in ignored repo-local state under `.symballist/config.json`. The install/onboarding docs should explicitly say that embeddings are disabled by default, that enabling them requires editing `.symballist/config.json`, and that this config change will not appear in git diff because `.symballist/` is ignored.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Install/onboarding docs explicitly state that embeddings are disabled by default after init
- [x] #2 Docs tell users to enable embeddings by editing .symballist/config.json in the target repo
- [x] #3 Docs call out that .symballist/ is gitignored so embedding-config changes will not show up in git diff
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated README onboarding and embeddings docs to state that embeddings are disabled by default after init, must be enabled in `.symballist/config.json`, and that `.symballist/` is gitignored so those config changes do not appear in git diff.
<!-- SECTION:FINAL_SUMMARY:END -->
