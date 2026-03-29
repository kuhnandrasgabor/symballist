---
id: TASK-016
title: 'Clarify retrieval confidence, score semantics, and trust signals'
status: Done
assignee: []
created_date: '2026-03-28 16:46'
updated_date: '2026-03-28 18:15'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Multiple agents found the current score output hard to interpret. Negative scores are fine internally, but they do not communicate confidence clearly. There is also a trust question around parsed symbols versus recovered oversized-file symbols versus file-level fallback records.

Capture a draft for output-level trust signaling. This should explore clearer score naming or transformation, a more understandable confidence model, and more explicit labeling of how trustworthy a hit is based on how it was extracted. It should also consider exposing brief match explanations such as matched symbol name, matched snippet text, matched import/reference, or recovered from oversized-file scan.

User value:
- reduces cognitive overhead when reading query output
- makes it easier to tell whether a hit is strong, weak, fallback, or recovered
- helps agents decide when to trust symballist versus when to verify more aggressively in source files

Observed motivation:
- negative score direction was called counterintuitive
- one agent wanted clearer confidence in output
- recovered-symbol and fallback behavior is helpful today but could surface trust level more explicitly
- recent feedback explicitly asked for reasons why a result matched so the ranking feels understandable instead of opaque
- current output shape is useful but not yet easy to scan as "exact", "strong", "related", or "fallback" at a glance
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a trust-signaling pass for retrieval output so query and show results are easier to interpret at a glance.

What changed
- query results now expose distance instead of the misleading raw FTS score; distance is the final lower-is-better ranking value after reranking adjustments
- query results now include confidence tiers (exact, strong, related, fallback) and a matchReason field such as exact_symbol_name, signature_text, body_text, or import_reference
- query results and show payloads now include extraction (parsed, recovered, fallback) plus trustLevel (high, medium, low) so recovered oversized-file symbols and file fallbacks are clearly labeled
- query output now includes a small resultSemantics block so downstream agents can interpret the fields without guessing

Verification
- bun test passes (18 tests)
- live co-ma query for AgentConfig shows exact match + recovered + medium trust
- live co-ma query for DistillationEngine shows exact match + recovered + medium trust, while nearby references show related confidence
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Clarified retrieval trust and score semantics by replacing raw score output with ranked distance and adding explicit confidence, matchReason, extraction, and trustLevel fields. Query/show output is now much easier to interpret without guessing why a result matched or how trustworthy its extraction path was.
<!-- SECTION:FINAL_SUMMARY:END -->
