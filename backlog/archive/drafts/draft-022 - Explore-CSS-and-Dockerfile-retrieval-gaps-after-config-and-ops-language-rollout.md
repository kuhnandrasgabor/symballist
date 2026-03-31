---
id: DRAFT-022
title: >-
  Explore CSS and Dockerfile retrieval gaps after config and ops language
  rollout
status: Draft
assignee: []
created_date: '2026-03-31 05:54'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream feedback after the YAML/shell/Dockerfile/CSS rollout was strong on YAML but mixed on CSS and Dockerfile retrieval ergonomics. CSS selector lookup worked for actual .css files in some cases but not for every direct selector query, and Dockerfile content appeared mainly through YAML compose references rather than as a clearly standalone Dockerfile hit. Explore whether the right follow-up is ranking or query tuning for config and ops symbols, better standalone Dockerfile symbol surfacing, or explicit non-goals around embedded CSS strings inside code.
<!-- SECTION:DESCRIPTION:END -->
