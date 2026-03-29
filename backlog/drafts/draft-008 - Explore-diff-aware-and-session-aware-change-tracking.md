---
id: DRAFT-008
title: Explore symbol-level and session-aware change tracking beyond file freshness
status: Draft
assignee: []
created_date: '2026-03-28 16:47'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One agent pointed out that freshness today only means file metadata matches the last index. That is good for retrieval safety, but it does not answer higher-level progress questions such as which symbols were added this session, how symbol inventories changed across commits, or how the codebase moved during an active development loop.

This draft now represents the deeper follow-up after the narrower file-level change-awareness slice. It is explicitly broader than the current stale-index detector and broader than simple file diffs. Treat it as a later exploratory slice, not an immediate blocker for core retrieval.

User value:
- supports progress tracking and development-session awareness
- could make symballist useful for navigation plus change summarization
- opens the door to agent workflows that ask what changed recently, not just where something is now

Observed motivation:
- agent specifically asked for ways to see which symbols were added in this session
- symbol/session history is distinct from current freshness checks and from the narrower file-level diff slice
<!-- SECTION:DESCRIPTION:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->
This later slice would likely require new storage or snapshots, for example:

- symbol inventories captured per index run or per session
- a notion of session boundaries
- symbol-level diffing between runs or against commit anchors

Potential questions this draft is meant to answer:

- which symbols were added or removed this session
- how did the symbol graph change since the last commit
- what changed structurally, not just at the file level

Why this is later:

- it is materially more expensive than file-level change awareness
- it introduces retention and historical-model questions
- it should only be pursued if file-level change awareness proves useful first
<!-- SECTION:NOTES:END -->
