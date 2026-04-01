---
id: DRAFT-030
title: Add Ruby mixin and inheritance relation extraction
status: Draft
assignee: []
created_date: '2026-04-01 05:40'
labels:
  - idea
  - ruby
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend Ruby indexing to emit graph edges for static structural constructs such as include, extend, prepend, and superclass inheritance. Keep the slice conservative and extraction-time only so Rails and Canvas repos gain more useful cross-file graph context without runtime simulation.
<!-- SECTION:DESCRIPTION:END -->
