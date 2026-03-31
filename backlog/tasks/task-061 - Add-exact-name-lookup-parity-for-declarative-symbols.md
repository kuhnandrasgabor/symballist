---
id: TASK-061
title: Add exact-name lookup parity for declarative symbols
status: Done
assignee: []
created_date: '2026-03-31 13:04'
updated_date: '2026-03-31 13:11'
labels:
  - feature
  - feedback
  - retrieval
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opus feedback: exact lookup remains strongest for code symbols, but declarative constructs such as CSS selectors, Dockerfile instructions, and YAML keys often still require semantic query instead of exact lookup. Add literal and exact-name retrieval parity for declarative indexed symbols so lookup works consistently across code and declarative surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 integration coverage proves lookup resolves CSS, YAML, and Dockerfile declarative symbols directly
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a narrow retrieval-layer fix in src/db.ts. searchSymbolsWithDiagnostics now supplements FTS and literal fallback candidates with exact raw-name, exact signature, and exact path matches before reranking. computeMatchAnalysis also treats exact signature equality as an exact-confidence match, which helps instruction-like declarative symbols such as Dockerfile directives behave more like direct code symbol lookups.

Added an integration regression in tests/integration.test.ts covering lookup of a CSS selector (.section-header), a YAML dotted key (services.api.image), and a Dockerfile instruction signature (WORKDIR /app).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Declarative exact lookup is now much closer to code-symbol lookup behavior. Exact-name and exact-signature matches are explicitly admitted into the candidate pool, so lookup can resolve CSS selectors, YAML dotted keys, and Dockerfile instruction lines directly instead of depending on semantic query or incidental FTS admission. Verified with bun test tests/integration.test.ts and bun run src/cli.ts lookup --help.
<!-- SECTION:FINAL_SUMMARY:END -->
