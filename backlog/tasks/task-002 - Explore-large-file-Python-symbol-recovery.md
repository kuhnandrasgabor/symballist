---
id: TASK-002
title: Explore large-file Python symbol recovery
status: To Do
assignee: []
created_date: '2026-03-28 14:20'
updated_date: '2026-03-28 14:24'
labels:
  - spike
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recover useful Python symbols from oversized files that currently exceed the safe tree-sitter runtime limit and collapse into a single file-level fallback record. This work should preserve the current reliable fallback path while extracting enough top-level structure from large files to surface real definitions such as AgentConfig in co-ma and improve downstream query relevance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Oversized Python files produce more than a single file-level fallback when a lightweight top-level symbol recovery path is available.
- [ ] #2 Recovered symbols from oversized files include accurate enough names, kinds, and spans to participate in query and show results.
- [ ] #3 The co-ma AgentConfig case is revalidated after the change and the true definition becomes discoverable if it exists in indexed oversized Python sources.
- [ ] #4 Existing behavior for normal-sized Python files, HTML files, and hard parse failures remains stable with test coverage.
<!-- AC:END -->
