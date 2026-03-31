---
id: TASK-074
title: Add optional graph --full neighbor expansion for deep traversal reads
status: Done
assignee: []
created_date: '2026-03-31 18:06'
updated_date: '2026-03-31 19:29'
labels:
  - ux
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream testing suggests a graph --full mode could collapse graph -> show --full into a single step for deep-reading workflows by expanding neighbor bodies inline when explicitly requested. Explore whether this belongs as a direct graph option, a separate neighbor-inspection surface, or a compact/full presentation toggle.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added graph --full to expand neighbor bodies inline while keeping default graph neighbors summarized and compact mode body-free. Graph output now reports graphSummary.neighborBodyMode, graph help/docs mention the new mode, and impact tracking only counts lookup_to_full_graph when full graph expansion was actually requested.
<!-- SECTION:NOTES:END -->
