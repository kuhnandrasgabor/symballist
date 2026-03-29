---
id: DRAFT-011
title: >-
  Calibrate confidence and match-reason heuristics so trust signals stay
  meaningful
status: Draft
assignee: []
created_date: '2026-03-28 18:22'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent downstream feedback says the new confidence and matchReason metadata are directionally useful, but in practice they can collapse into low-information defaults such as `confidence=related` and `matchReason=body_text` across many results. Capture a follow-up draft focused on calibrating those heuristics so exact and strong tiers fire when expected, match reasons reflect the real dominant match path, and trust semantics remain understandable when recovered symbols compete with parsed references.

User value:
- makes the trust metadata actually actionable instead of merely decorative
- reduces confusion when an exact recovered symbol shows medium trust while a weaker parsed reference shows high trust
- helps agents decide whether to accept, inspect, or rerank a result more confidently

Observed motivation:
- one downstream agent explicitly reported that confidence appeared uniformly `related` in practice, which means the current tiering is not yet carrying enough information
- the same pass noted that matchReason also looked stuck on `body_text`, suggesting our surfaced reason is not yet mapping cleanly to what users perceive as the dominant match
- another agent found the exact-vs-trust interaction cognitively surprising: an exact recovered match can look "less trustworthy" than a parsed but less direct reference, even when the result ordering is right
<!-- SECTION:DESCRIPTION:END -->
