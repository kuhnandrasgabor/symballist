---
id: TASK-019
title: >-
  Calibrate confidence and match-reason heuristics so trust signals stay
  meaningful
status: Done
assignee: []
created_date: '2026-03-28 18:22'
labels: []
dependencies: []
priority: high
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Query-time trust levels now combine extraction quality with retrieval confidence instead of reflecting parse quality alone.
- Exact recovered symbols now surface as high-trust query hits, which better matches user expectation when the result itself is clearly the right symbol.
- Match reasons now distinguish generic lexical leftovers as `token_overlap` instead of over-reporting `body_text`.
- Normalized phrase hits across signature/body/doc now promote to stronger confidence tiers before generic overlap fallback.

Verification
- `bun test` passes with 21 tests.
- Live `co-ma` check for `DistillationEngine` now returns the recovered class with `confidence: exact`, `matchReason: exact_symbol_name`, and `trustLevel: high`.
- Live `co-ma` check for `gateway config api live reload` now returns useful `token_overlap` reasons instead of collapsing unrelated hits into `body_text`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
Trust signaling is more actionable now. Query results separate strong phrase/name/path matches from generic token overlap, and query-time trust better reflects both how the symbol was extracted and how directly it matched the user query.
<!-- SECTION:SUMMARY:END -->
