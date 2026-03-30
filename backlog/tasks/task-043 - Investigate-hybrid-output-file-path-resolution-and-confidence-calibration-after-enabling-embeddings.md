---
id: TASK-043
title: >-
  Investigate hybrid output file-path resolution and confidence calibration
  after enabling embeddings
status: To Do
assignee: []
created_date: '2026-03-30 07:43'
labels:
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing with Claude Sonnet after enabling Ollama embeddings found that hybrid retrieval is useful, but two issues remain unclear. First, some output appears to surface unresolved or missing file-path labels (`file: ?` in the consuming runtime), which may indicate stale index state, a display issue in compact mode, or incomplete path propagation in the output contract. Second, hybrid results were observed to stay at `confidence: medium`, suggesting calibration may be too conservative or mismatched for the active embedding/index combination. Investigate both behaviors and tighten the output so hybrid-mode trust and location signals remain actionable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hybrid-mode outputs preserve actionable file-path/location information in normal and compact consumption paths
- [ ] #2 Docs or output semantics clarify whether stale indexes, compact mode, or client rendering can affect displayed path labels
- [ ] #3 Confidence behavior in hybrid mode is calibrated or explained so strong semantic hits can be distinguished from middling matches
<!-- AC:END -->
