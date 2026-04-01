---
id: TASK-092
title: Fix namespace-qualified Ruby lookup ranking and nested constant resolution
status: Done
assignee: []
created_date: '2026-04-01 14:35'
updated_date: '2026-04-01 14:40'
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
Namespace-qualified Ruby lookups such as Kids::Merge and Sis::V2::Services::Writing::Student can rank unrelated short-name matches above the intended module or class. Improve query-time weighting so :: segments and deep namespace agreement prefer the correct nested Ruby symbol in lookup/show/graph flows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lookup 'Kids::Merge' ranks the Kids::Merge module above unrelated short-name symbols like KidsImport
- [ ] #2 deep namespace lookups such as Sis::V2::Services::Writing::Student resolve to the nested class symbol rather than an unrelated Student method or short-name match
- [ ] #3 integration coverage exercises namespace-qualified Ruby lookups in lookup and graph/show flows
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Improved namespace-qualified Ruby lookup scoring so ::-qualified queries treat matching class/module signatures as first-class exact signals and rank namespaced class/module definitions above unrelated short-name symbols or nested methods. Added integration coverage for Kids::Merge vs KidsImport and for fully-qualified class lookups competing with nested methods.
<!-- SECTION:NOTES:END -->
