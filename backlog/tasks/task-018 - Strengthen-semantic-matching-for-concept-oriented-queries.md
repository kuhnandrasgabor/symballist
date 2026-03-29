---
id: TASK-018
title: Strengthen semantic matching for concept-oriented queries
status: Draft
assignee: []
created_date: '2026-03-28 16:47'
labels: []
dependencies: []
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
