---
id: TASK-051
title: Add explicit result quality and no-strong-match signaling to retrieval output
status: Done
assignee: []
created_date: '2026-03-31 06:44'
updated_date: '2026-03-31 06:47'
labels:
  - retrieval
  - trust
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Weak or stale query cases still return noisy low-confidence results without a clear top-level signal that the match quality is poor. Add a retrieval-level quality indicator and explicit no-strong-match behavior so agents can distinguish strong, moderate, weak, and effectively-no-good-result cases without inferring that solely from per-result confidence. Keep the existing result payloads, but add an explicit summary on query and lookup outputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Query and lookup outputs include a stable top-level retrieval-quality summary that downstream consumers can inspect directly
- [x] #2 The summary explicitly distinguishes strong, moderate, weak, and no-good-result cases, including a no-strong-match signal when applicable
- [x] #3 Integration coverage proves a strong query and a weak low-signal query expose the expected top-level quality states
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a compact-safe top-level resultQuality summary to query and lookup outputs. The summary reports level, reason, noStrongMatch, strongMatchCount, resultCount, and the top result's confidence/trust so downstream agents can branch on retrieval quality without reverse-engineering per-result fields. Added integration coverage for strong, weak fallback, and empty-result cases while keeping the existing payload shape intact.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Query and lookup now emit explicit retrieval-quality summaries. Strong hits report resultQuality.level=strength with noStrongMatch=false, weak fallback hits and low-signal queries report noStrongMatch=true with weak or moderate quality as appropriate, and empty result sets report level=none. Verified with bun test (48 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
