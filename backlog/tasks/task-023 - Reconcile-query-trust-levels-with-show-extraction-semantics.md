---
id: TASK-023
title: Reconcile query trust levels with show extraction semantics
status: Draft
assignee: []
created_date: '2026-03-28 22:21'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent downstream feedback says the same symbol can appear with `trustLevel: high` in query output but `trustLevel: medium` in show, which makes the metadata harder to trust. Capture a follow-up to reconcile query-time trust semantics with show-time extraction semantics, either by aligning the meanings, renaming the fields, or surfacing both axes explicitly. User value: reduces confusion, makes trust metadata more predictable, and helps agents understand whether a trust signal refers to retrieval confidence, extraction quality, or both. Observed motivation: downstream testing found `DistillationEngine` returning `trustLevel: high` in query but `trustLevel: medium` in show for the same recovered symbol, which feels inconsistent even though the current logic is technically explainable.
<!-- SECTION:DESCRIPTION:END -->
