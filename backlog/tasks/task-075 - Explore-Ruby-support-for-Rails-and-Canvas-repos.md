---
id: TASK-075
title: Explore Ruby support for Rails and Canvas repos
status: Done
assignee: []
created_date: '2026-03-30 11:33'
updated_date: '2026-03-31 19:49'
labels:
  - idea
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ruby is the highest-value remaining language expansion because it would make symballist more useful on Rails and Canvas codebases used by colleagues. The current parser-per-language architecture should support a pragmatic first Ruby slice without unusual infrastructure work: add `.rb` file discovery, a Ruby extractor, tests, and docs. Estimated lift is moderate rather than large, roughly one focused implementation slice, and materially smaller than C# or C++.
<!-- SECTION:DESCRIPTION:END -->

## Notes

- Intake summary
  - Split the old mixed Ruby/C#/C++ wave into separate drafts because the effort and risk are not comparable.
- Sizing
  - Ruby first slice: classes, modules, instance/class methods, and useful constants.
  - Estimated effort: about 1 to 2 focused days including tests and docs.
  - Risk: low to medium.
- Why first
  - Best near-term leverage because Canvas is Ruby-based and this would immediately help colleague adoption.
- Recommended next action
  - Promote Ruby separately when you want the next language-expansion execution slice.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added first-slice Ruby support: .rb discovery, tree-sitter-ruby parser wiring, extracted classes/modules/methods/constants, lightweight require/require_relative import relations, and conservative call/use relations. Updated README and generated instruction surfaces to include Ruby in supported language coverage, and added integration coverage for Ruby indexing and relations.
<!-- SECTION:NOTES:END -->
