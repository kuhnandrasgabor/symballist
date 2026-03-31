---
id: TASK-053
title: Clarify lookup versus query behavior in descriptions and tool guidance
status: Done
assignee: []
created_date: '2026-03-31 07:12'
updated_date: '2026-03-31 07:15'
labels:
  - ux
  - agent-experience
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Exact symbol lookup is strong, but the distinction between lookup and query is still easy for agents to miss because both commands accept similar inputs. Make the behavioral difference explicit in help text, tool descriptions, generated manifests, and onboarding guidance: lookup means best-match-plus-context, while query means ranked candidate exploration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI help and README/onboarding guidance clearly distinguish lookup as best-hit-plus-context and query as ranked candidate exploration
- [x] #2 Generated tool descriptions and agent snippets use the same distinction consistently
- [x] #3 Integration coverage or output assertions pin at least one of the updated guidance surfaces
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Clarified the command split across CLI help, README, adoption guidance, generated instruction snippets, and tool manifest descriptions. Query is now described as ranked candidate exploration, lookup as a one-shot best-match-plus-context flow, and show as direct inspection of a known id or exact symbol name.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Lookup versus query behavior is now described consistently across help text, docs, and generated tool guidance. Agents should now see the intended split clearly: query for ranked exploration, lookup for one selected best hit with context, and show for direct symbol inspection. Verified with bun test (49 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
