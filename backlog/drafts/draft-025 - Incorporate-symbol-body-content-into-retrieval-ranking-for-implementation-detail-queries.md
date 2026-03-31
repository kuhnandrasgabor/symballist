---
id: DRAFT-025
title: >-
  Incorporate symbol body content into retrieval ranking for
  implementation-detail queries
status: Draft
assignee: []
created_date: '2026-03-31 13:04'
labels:
  - feature
  - feedback
  - retrieval
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opus feedback: implementation-detail queries often depend on terms that appear only in a function or method body, not the symbol name or signature. Explore body-aware lexical or hybrid ranking so queries about polling, progress, caching behavior, or inner logic surface the right implementation without falling back to grep.
<!-- SECTION:DESCRIPTION:END -->
