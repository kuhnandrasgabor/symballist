---
id: DRAFT-004
title: 'Clarify retrieval confidence, score semantics, and trust signals'
status: Draft
assignee: []
created_date: '2026-03-28 16:46'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Multiple agents found the current score output hard to interpret. Negative scores are fine internally, but they do not communicate confidence clearly. There is also a trust question around parsed symbols versus recovered oversized-file symbols versus file-level fallback records.

Capture a draft for output-level trust signaling. This should explore clearer score naming or transformation, a more understandable confidence model, and more explicit labeling of how trustworthy a hit is based on how it was extracted.

User value:
- reduces cognitive overhead when reading query output
- makes it easier to tell whether a hit is strong, weak, fallback, or recovered
- helps agents decide when to trust symballist versus when to verify more aggressively in source files

Observed motivation:
- negative score direction was called counterintuitive
- one agent wanted clearer confidence in output
- recovered-symbol and fallback behavior is helpful today but could surface trust level more explicitly
<!-- SECTION:DESCRIPTION:END -->
