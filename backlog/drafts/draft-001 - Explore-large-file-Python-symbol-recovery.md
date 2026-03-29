---
id: DRAFT-001
title: Explore large-file Python symbol recovery
status: Draft
assignee: []
created_date: '2026-03-28 14:20'
labels:
  - idea
  - spike
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate how symballist should recover top-level Python symbols from oversized files that currently fall back to a single file record because tree-sitter parsing exceeds the safe runtime limit. This matters because real definitions such as AgentConfig in co-ma may be absent from the index even when query ranking is otherwise strong.
<!-- SECTION:DESCRIPTION:END -->
