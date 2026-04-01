---
id: TASK-097
title: >-
  Fix residual deep Ruby namespace resolution misses in real-world nested class
  lookups
status: Done
assignee: []
created_date: '2026-04-01 15:09'
updated_date: '2026-04-01 15:11'
labels:
  - bug
  - ruby
  - retrieval
  - graph
  - language-specific
  - any-scale
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream retesting in mc-mothership shows that moderate namespace-qualified Ruby lookups such as Kids::Merge are now fixed, but deeper chains like Sis::V2::Services::Writing::Student can still rank a lowercase method symbol above the intended nested Student class unless --path is supplied. Tighten deep namespace-aware ranking so long Ruby module chains consistently prefer the fully-qualified class or module definition.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lookup of deep Ruby namespace chains such as Sis::V2::Services::Writing::Student resolves to the intended nested class or module definition without requiring --path
- [ ] #2 ranking does not regress the already-fixed Kids::Merge and similar moderate namespace cases
- [ ] #3 integration coverage exercises a deep namespace chain with a competing lowercased method symbol and proves the class/module wins
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Hardened deep Ruby namespace lookup scoring so long :: chains no longer let non-class/module tail-segment matches outrank the intended nested definition. Long namespace queries now demote same-name methods while preserving the already-fixed namespace-qualified class/module wins. Added integration coverage for a deep namespace class competing with a lowercase tail-segment method in the same file.
<!-- SECTION:NOTES:END -->
