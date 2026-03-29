---
id: TASK-018
title: Strengthen semantic matching for concept-oriented queries
status: Done
assignee: []
created_date: '2026-03-28 16:47'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agent feedback makes a useful distinction between two failure modes: sometimes the right implementation exists in the lexical results but is ranked too low, and sometimes the query itself is conceptual enough that lexical symbol-adjacent matching is the real limitation. Examples like memory store and broader conceptual lookups suggest symballist will eventually need stronger concept matching, not just better heuristics on lexical hits.

Capture this as a separate retrieval-quality draft from implementation-first ranking. This draft is about semantic recall for concept queries, likely connecting back to the project's longer-term hybrid lexical plus embedding direction.

User value:
- improves results when the user knows the concept but not the exact symbol names
- makes broad code questions feel more intelligent and less wording-sensitive
- complements ranking improvements rather than replacing them

Observed motivation:
- one agent explicitly asked for stronger semantic matching for concept queries, not just symbol-adjacent text
- the project vision already mentions optional embeddings and hybrid retrieval, so this is aligned with the longer-term architecture
- updated feedback reinforced that concept queries such as `distiller` still feel less dependable than direct symbol-name queries like `DistillationEngine`
- the current state is now "genuinely useful" for day-to-day discovery, which makes the remaining concept-query gap more visible and worth isolating as its own follow-up
- another downstream pass sharpened the need further: `memory store` and `distiller` still tend to surface wiring, tests, or adjacent usage before the canonical implementation symbol the user most likely wants
- the core opportunity now is not "make concept queries return something" but "make concept queries land on the main implementation object first often enough to feel intentional"
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added concept-aware reranking that promotes definition symbols from source files whose module or file stem matches broad conceptual queries.
- Added supplemental source-path candidate expansion so canonical implementation files can still participate even when raw FTS results are dominated by wiring or tests.
- Tightened generic normalized-name contains matches for non-symbol queries so verbose test names do not outrank canonical implementations as easily.
- Added regression coverage showing `distiller` can land on `DistillationEngine` in `src\\distiller.py` through concept/path matching instead of only symbol-name matching.

Verification
- `bun test` passes with 20 tests.
- Live `co-ma` checks now return `src\\coma\\memory\\distiller.py` `class DistillationEngine` first for `distiller`.
- Live `co-ma` checks now return `src\\coma\\memory\\store.py` `class MemoryStore` first for `memory store`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
Concept-oriented queries now have a stronger path to canonical implementation symbols. Symballist supplements lexical FTS hits with source-path candidates and reranks them using module/file affinity, which materially improves broad concept lookups without requiring embeddings yet.
<!-- SECTION:SUMMARY:END -->
