---
id: TASK-014
title: Prefer exact symbol definitions over references for symbol-shaped queries
status: Done
assignee: []
created_date: '2026-03-28 17:37'
updated_date: '2026-03-28 17:47'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Updated retrieval feedback says exact symbol-shaped queries like `DistillationEngine` are useful now, but the real class or definition does not always reach rank 1. Capture a draft to strengthen definition-first ranking for symbol-name queries so exact class/function definitions outrank nearby references, parameter mentions, imports, and incidental snippet matches when the query clearly looks like a symbol name.

This is intentionally separate from broader semantic-query work. The focus here is predictable behavior when the user already knows a likely symbol and expects the owning definition to win.

User value:
- makes symbol-name retrieval feel trustworthy enough to use as a first stop
- reduces the need for agents to mentally sift through references when they are really asking for the definition
- complements implementation-first ranking without conflating exact-name matching with conceptual retrieval

Observed motivation:
- recent live feedback said the real `DistillationEngine` class appears, but not consistently at rank 1
- one agent explicitly asked that exact symbol-name matches outrank imports, references, and nearby mentions
- the tool now feels broadly useful enough that this definition-first behavior is a clear next trust improvement
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Strengthened exact-name ranking for symbol-shaped queries so the owning definition wins more reliably over normalized references and nearby mentions.

What changed
- added symbol-query detection for CamelCase and snake_case style symbol names
- direct-match scoring now distinguishes exact textual matches from looser normalized matches
- exact definition-like symbols (class/function/title/element/heading) get a stronger boost for symbol-shaped queries
- body/signature-only matches are intentionally weaker for symbol-shaped queries so references do not crowd out the owning definition
- added a regression test with DistillationEngine vs distillation_engine/test-shaped references

Verification
- bun test passes (16 tests)
- live co-ma query for DistillationEngine now returns src\\coma\\memory\\distiller.py class DistillationEngine as the top result
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Improved definition-first ranking for symbol-shaped queries. Exact owning definitions now outrank normalized references more reliably, and live dogfooding in co-ma shows DistillationEngine surfacing at rank 1.
<!-- SECTION:FINAL_SUMMARY:END -->
