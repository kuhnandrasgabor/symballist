---
id: DRAFT-015
title: Add explicit result quality and no-strong-match signaling to retrieval output
status: Draft
assignee: []
created_date: '2026-03-29 19:17'
labels:
  - retrieval
  - trust
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Weak or stale query cases still return noisy low-confidence results without a clear top-level signal that the match quality is poor. Track a retrieval-level quality indicator and explicit no-strong-match behavior so agents can distinguish strong, moderate, weak, and effectively-no-good-result cases without inferring that solely from per-result confidence. Include deleted-file or old-marker fallback cases as motivating examples.
<!-- SECTION:DESCRIPTION:END -->
