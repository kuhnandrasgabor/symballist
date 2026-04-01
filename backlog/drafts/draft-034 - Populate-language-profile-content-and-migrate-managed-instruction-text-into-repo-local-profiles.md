---
id: DRAFT-034
title: >-
  Populate language profile content and migrate managed instruction text into
  repo-local profiles
status: Draft
assignee: []
created_date: '2026-04-01 07:35'
labels:
  - global
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow the language-aware init backbone by moving existing language-specific guidance out of hardcoded fs.ts template strings into deterministic profile content files, starting with shared/general content plus Ruby-specific guidance and then the remaining supported languages. Keep generated output stable while reducing monolithic hardcoded snippet text.
<!-- SECTION:DESCRIPTION:END -->
