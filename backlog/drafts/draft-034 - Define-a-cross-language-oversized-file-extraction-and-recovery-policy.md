---
id: DRAFT-034
title: Define a cross-language oversized-file extraction and recovery policy
status: Draft
assignee: []
created_date: '2026-04-01 12:46'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Symballist now has two concrete oversized-file recovery implementations: Python large-file symbol recovery (TASK-002) and JavaScript oversized-script recovery for large frontend modules. This should be treated as an emerging cross-language architecture rather than a sequence of isolated band-aids. Define the generic policy layer for when files exceed safe parser limits, how recovery vs fallback is chosen, how extraction trust is reported, and which language-specific adapters exist or are still missing.
<!-- SECTION:DESCRIPTION:END -->
