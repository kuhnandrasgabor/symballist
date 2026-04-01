---
id: DRAFT-031
title: Add repo guidance for vendored and third-party path scoping in Ruby-heavy repos
status: Draft
assignee: []
created_date: '2026-04-01 06:11'
labels:
  - idea
  - docs
  - ruby
  - setup
  - language-specific
  - large-repo
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document how Ruby-heavy repos with vendored code, submodules, generated assets, or third-party bundles should use the repo-scoped ignore/scope mechanism from DRAFT-027 so app code is not crowded out by bundled dependencies.

This is intentionally not the main product mechanism. The system-level solution should live in DRAFT-027; this draft is about adoption guidance for Ruby, Rails, and Canvas-style repos where submods/, bundled front-end assets, or archive/vendor areas often need explicit scoping from day one.

Examples this guidance should cover:
- vendored submodules such as `submods/`
- third-party bundles such as `pdf.js`
- generated or archived zones that should not compete with app code by default
- repo layouts where human-authored scope rules are preferable to hardcoded heuristics

Recommended direction: keep retrieval behavior generic, document Ruby-specific setup advice instead of baking Ruby/vendor assumptions into ranking logic, and only revisit hardcoded handling if repo-scoped ignore controls still leave a Ruby-specific gap afterward.
<!-- SECTION:DESCRIPTION:END -->
