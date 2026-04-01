---
id: TASK-085
title: >-
  Investigate JavaScript symbol extraction miss for real-world plain class files
  such as ClusteringCard.js
status: To Do
assignee: []
created_date: '2026-04-01 10:50'
labels:
  - global
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream smoke testing reported that ClusteringCard.js was not indexed in a large repo even though it contains a plain class declaration. A direct local regression proved that simple non-exported top-level class declarations are already indexed, so the real bug is likely a narrower parser or source-shape issue in that file class rather than a blanket lack of support for plain JS classes. Investigate the actual file pattern and fix extraction without regressing the passing plain-class case.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fixture reproduces the real-world JavaScript class extraction miss more faithfully than a simple top-level class declaration.
- [ ] #2 The extractor indexes the reproduced class symbol correctly after the fix.
- [ ] #3 Existing JavaScript and TypeScript extraction coverage continues to pass.
<!-- AC:END -->
