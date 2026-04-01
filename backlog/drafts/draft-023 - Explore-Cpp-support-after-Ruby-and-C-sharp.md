---
id: DRAFT-023
title: Explore C++ support after Ruby and C#
status: Draft
assignee: []
created_date: '2026-03-31 19:36'
labels:
  - idea
  - cpp
  - language-specific
  - any-scale
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
C++ is the hardest of the remaining language expansions and should stay separate from Ruby and C#. A pragmatic first slice is still possible, but useful support would need to handle namespaces, classes or structs, enums, free functions, methods, headers, and declarations versus definitions without overpromising on templates or macros. This is a larger, riskier follow-up wave after Ruby and probably after C#.
<!-- SECTION:DESCRIPTION:END -->

## Notes

- Sizing
  - Estimated effort: about 3 to 5 focused days including tests and docs.
  - Risk: high.
- Why later
  - The language surface and extraction ambiguity are both meaningfully harder than Ruby and C#.
- Recommended next action
  - Keep this as the last expansion wave unless a concrete C++ repo need jumps ahead of priority.
