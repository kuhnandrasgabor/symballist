---
id: DRAFT-024
title: Explore C# support after Ruby
status: Draft
assignee: []
created_date: '2026-03-31 19:36'
labels:
  - idea
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
C# is feasible in the existing architecture, but it is a materially larger and more semantics-heavy lift than Ruby. A useful first slice would need namespaces, classes, interfaces, enums or records, methods, and probably properties to feel credible in real repos. Treat it as the second language-expansion wave after Ruby rather than bundling it into the same task.
<!-- SECTION:DESCRIPTION:END -->

## Notes

- Sizing
  - Estimated effort: about 2 to 3 focused days including tests and docs.
  - Risk: medium.
- Why later than Ruby
  - More symbol shapes to model well before retrieval feels trustworthy.
- Recommended next action
  - Keep this as the second language-expansion draft after Ruby validates the next parser wave.

