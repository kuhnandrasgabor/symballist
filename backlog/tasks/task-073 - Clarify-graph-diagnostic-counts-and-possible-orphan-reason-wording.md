---
id: TASK-073
title: Clarify graph diagnostic counts and possible-orphan reason wording
status: To Do
assignee: []
created_date: '2026-03-31 19:23'
labels:
  - ux
  - graph
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream retesting after TASK-057 found two remaining graph-diagnostic polish issues: knownOutboundReferences can read lower than the visible graph edge count because diagnostics appear to count unique connected targets rather than relation entries, and possibleOrphanReasons can still include 'no known inbound references' even when possibleOrphanCandidate is false due to root-like status or other overriding context. Clarify or adjust these semantics so the payload reads consistently to downstream consumers.
<!-- SECTION:DESCRIPTION:END -->
