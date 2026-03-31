---
id: TASK-071
title: Separate auto-watch refresh traffic from intentional impact-tracking usage
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
Downstream testing shows background watch refreshes dominate impactTracking summaries and drown out intentional agent retrieval behavior. Adjust impact tracking so infrastructure refreshes are excluded or reported separately from explicit user or agent-initiated command usage.
<!-- SECTION:DESCRIPTION:END -->
