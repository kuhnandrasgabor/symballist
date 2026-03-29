---
id: DRAFT-008
title: Explore diff-aware and session-aware change tracking
status: Draft
assignee: []
created_date: '2026-03-28 16:47'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One agent pointed out that freshness today only means file metadata matches the last index. That is good for retrieval safety, but it does not answer higher-level progress questions such as what changed since the last commit, which symbols were added this session, or how the codebase moved during an active development loop.

Capture a draft for change-awareness beyond plain freshness. This is explicitly broader than the current stale-index detector and should be treated as a later exploratory slice, not an immediate blocker for core retrieval.

User value:
- supports progress tracking and development-session awareness
- could make symballist useful for navigation plus change summarization
- opens the door to agent workflows that ask what changed recently, not just where something is now

Observed motivation:
- agent specifically asked for ways to see what changed since last commit or which symbols were added in this session
- this idea is distinct from current freshness checks and should stay separate in backlog
<!-- SECTION:DESCRIPTION:END -->
