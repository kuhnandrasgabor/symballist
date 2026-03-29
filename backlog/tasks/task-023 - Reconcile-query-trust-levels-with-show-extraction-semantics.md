---
id: TASK-023
title: Reconcile query trust levels with show extraction semantics
status: Done
assignee: []
created_date: '2026-03-28 22:21'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent downstream feedback says the same symbol can appear with `trustLevel: high` in query output but `trustLevel: medium` in show, which makes the metadata harder to trust. Capture a follow-up to reconcile query-time trust semantics with show-time extraction semantics, either by aligning the meanings, renaming the fields, or surfacing both axes explicitly. User value: reduces confusion, makes trust metadata more predictable, and helps agents understand whether a trust signal refers to retrieval confidence, extraction quality, or both. Observed motivation: downstream testing found `DistillationEngine` returning `trustLevel: high` in query but `trustLevel: medium` in show for the same recovered symbol, which feels inconsistent even though the current logic is technically explainable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Query and show no longer use the same `trustLevel` field to mean two different things.
- [x] #2 Query output clearly distinguishes extraction trust from retrieval trust.
- [x] #3 Show output makes it explicit that its trust signal is extraction-only.
- [x] #4 Regression coverage proves recovered exact hits stay consistent between query and show.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented by splitting trust semantics instead of collapsing them:

- `trustLevel` now consistently means extraction trust in both query and show.
- Query results now also expose `retrievalTrustLevel` for query-time match confidence.
- Query `resultSemantics` now explains both trust axes inline.
- Show output now includes a `trustSemantics` block stating that its `trustLevel` is extraction-only.

Verification:

- `bun test` passes with 26 tests.
- Added regression coverage proving a recovered exact symbol reports `trustLevel: medium` in both query and show while query separately reports `retrievalTrustLevel: high`.
<!-- SECTION:NOTES:END -->
