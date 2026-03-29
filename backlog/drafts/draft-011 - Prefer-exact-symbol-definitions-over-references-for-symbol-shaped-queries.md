---
id: DRAFT-011
title: Prefer exact symbol definitions over references for symbol-shaped queries
status: Draft
assignee: []
created_date: '2026-03-28 17:37'
labels: []
dependencies: []
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
