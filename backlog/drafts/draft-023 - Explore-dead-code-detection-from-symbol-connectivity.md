---
id: DRAFT-023
title: Explore dead-code detection from symbol connectivity
status: Draft
assignee: []
created_date: '2026-03-31 05:59'
labels:
  - idea
  - spike
  - graph
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore whether symballist should expose a lightweight dead-code or orphaned-symbol signal derived from its indexed symbol relations. The idea is to use the existing network of connected symbols as a starting point for flagging symbols that appear disconnected, unreachable, or otherwise likely unused, without overcommitting to a full call-graph engine.

User value:
- helps agents notice likely dead code while navigating a repo
- turns the symbol graph into a maintenance signal, not just a retrieval aid
- could surface cleanup candidates or confidence warnings during retrieval workflows
<!-- SECTION:DESCRIPTION:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->
Intake summary
- User suggested adding a function to track dead code, motivated by the project already building a network of connected symbols.

Related backlog items
- TASK-033 established the staged graph-aware retrieval roadmap, but it focused on retrieval quality and bounded context assembly rather than dead-code analysis.
- TASK-034 implemented one-hop graph-aware reranking signals inside the current candidate set, which may provide some raw graph inputs but does not attempt reachability or unused-symbol detection.
- DRAFT-008 explores richer symbol/session change tracking; it is adjacent in that both ideas treat symbols as more than static search entries, but it does not cover dead-code detection.

Potential conflicts
- README currently keeps deep call graph analysis out of scope for the current generation, so this should stay explicitly lightweight and exploratory.
- Unused or dead-code detection quality will vary sharply by language because the current graph model is shallow and relation coverage is uneven outside Python-centric import structure.
- A retrieval helper that guesses dead code too aggressively could damage trust if it presents weak reachability evidence as a strong fact.

Open questions
- Should the first slice only surface weak signals such as low-connectivity or unreferenced symbols, rather than claiming true dead-code detection?
- Is the right product shape a standalone command/report, a query-time hint, or an offline maintenance/debugging tool?
- Which languages should be eligible before the signal is exposed to users?

Recommended next action
- Keep this as a draft spike until there is appetite to evaluate bounded, explainable heuristics that fit inside the existing lightweight graph model.
<!-- SECTION:NOTES:END -->
