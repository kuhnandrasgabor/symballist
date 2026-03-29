---
id: DRAFT-012
title: Add summary mode or truncation defaults for large show results
status: Draft
assignee: []
created_date: '2026-03-28 18:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback from real downstream use says show --name on large classes such as MemoryStore can return bodies that are technically correct but impractically large for normal navigation. Capture a draft to explore better defaults for very large symbol bodies, such as summary mode, first-N-lines output, explicit expansion flags, or a body-size threshold that preserves full access without overwhelming the default workflow.

User value:
- keeps `show` useful for inspection instead of flooding the terminal with tens of kilobytes of body text
- preserves the new convenience of `show --name` even for very large symbols
- makes follow-up context more scannable in normal agent workflows

Observed motivation:
- downstream feedback explicitly called out `show --name MemoryStore` returning a roughly 57 KB class body, which is correct but ergonomically overwhelming
- the current retrieval loop is now good enough that giant `show` payloads are becoming the next practical friction point during inspection
<!-- SECTION:DESCRIPTION:END -->
