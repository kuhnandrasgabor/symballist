---
id: TASK-046
title: Add config and ops language support for YAML shell Dockerfile and CSS
status: Done
assignee: []
created_date: '2026-03-30 20:25'
updated_date: '2026-03-30 20:28'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the second modern-stack expansion wave by adding useful retrieval coverage for common config and operational files: YAML, shell/bash, Dockerfile, and CSS. This slice should favor pragmatic extraction that helps codebase navigation without forcing every language into a heavyweight code-symbol model. Use lightweight, stable extraction where that is a better fit than deep parser-backed semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Symballist discovers common YAML, shell, Dockerfile, and CSS files and reports those languages in status output when indexed
- [x] #2 Extraction returns useful navigable records for common config/ops structures such as YAML keys, shell functions, Docker build stages or instructions, and CSS selectors
- [x] #3 Integration tests cover indexing and retrieval for the new config/ops languages without regressing existing languages
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend language detection to include YAML, shell, Dockerfile, and CSS, including basename handling for Dockerfile-style files.
2. Implement lightweight extraction tailored to each file type instead of forcing a uniform heavy parser model.
3. Add integration tests for indexing, retrieval, and status output for the new languages.
4. Run the full suite and fix any regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended source discovery to include YAML, shell, Dockerfile, and CSS, including basename-based detection for Dockerfile and Containerfile.
Implemented lightweight extractors for YAML keys, shell functions, Dockerfile stages/ARG/ENV entries, and CSS selectors/at-rules.
Added integration coverage for indexing, retrieval, language reporting, and Dockerfile discovery.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the config-and-ops language expansion wave with pragmatic lightweight extraction rather than heavyweight parser-backed modeling.
Verified with `bun test` on 2026-03-30: 45 pass, 0 fail.
Scope delivered: YAML, shell/bash, Dockerfile, and CSS discovery plus useful navigable symbol records for retrieval.
<!-- SECTION:FINAL_SUMMARY:END -->
