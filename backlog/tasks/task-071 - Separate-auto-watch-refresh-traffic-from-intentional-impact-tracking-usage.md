---
id: TASK-071
title: Separate auto-watch refresh traffic from intentional impact-tracking usage
status: Done
assignee: []
created_date: '2026-03-31 18:06'
updated_date: '2026-03-31 18:54'
labels:
  - ux
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing shows background watch refreshes dominate impactTracking summaries and drown out intentional agent retrieval behavior. Adjust impact tracking so infrastructure refreshes are excluded or reported separately from explicit user or agent-initiated command usage.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Separated background watch refreshes from intentional impact-tracking usage. impactTracking.summary now tracks watch under infrastructureCommandCounts / recordedInfrastructureCommands and leaves commandCounts / recordedCommands for intentional commands. Added integration coverage.
<!-- SECTION:NOTES:END -->
