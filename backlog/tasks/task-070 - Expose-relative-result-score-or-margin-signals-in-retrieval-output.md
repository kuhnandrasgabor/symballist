---
id: TASK-070
title: Expose relative result score or margin signals in retrieval output
status: To Do
assignee: []
created_date: '2026-03-31 18:06'
labels:
  - ux
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing found query results hard to calibrate because score appears as null in consumer-visible output. Add a lightweight result-score or margin signal that helps callers judge how much better the top hit is than nearby alternatives without overclaiming absolute confidence.
<!-- SECTION:DESCRIPTION:END -->
