---
id: DRAFT-035
title: Clarify indexing progress and Ollama availability during embedding runs
status: Draft
assignee: []
created_date: '2026-04-03 08:24'
labels:
  - idea
  - bug
  - embeddings
  - indexing
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Index output can currently mislead users about actual progress when file indexing and embedding generation overlap. The progress line can show a file as skipped while background embedding work is still active, which makes the run look further along or more complete than it really is. Separately, first-run failures such as an Ollama connection error are only discovered after indexing has already started, even though earlier guidance or preflight signaling could make the dependency clearer. Capture the UX and observability gap around phase reporting, background embedding state, and provider-availability messaging so indexing feels truthful and easier to recover from.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Intake summary
- Reported UX issue: the index console line can show output like `[index] [####################----] 130/156 indexed:0 skipped:130 symbols:0 ...` even though embedding work is still running in the background.
- Reported first-run issue: an eventual embedding error of `Unable to connect. Is the computer able to access the url?` only made it obvious after the fact that Ollama was not started.
- Desired outcome: make indexing state truthful about the active phase and expose clearer early guidance when embeddings depend on a local provider that is unavailable.

Related backlog items
- DRAFT-025 overlaps on embedding throughput during indexing, but that draft focuses on performance and concurrency rather than truthful user-facing progress and phase reporting.
- DRAFT-028 overlaps on embedding failure handling, but it focuses on oversized input and context-length failures rather than provider availability or console UX.
- TASK-036 and TASK-039 improved onboarding and embeddings setup docs, but they do not cover runtime preflight messaging or in-run progress semantics.

Potential conflicts
- Surfacing separate indexing versus embedding phases may require changing the current single-line progress model or adding more state to the run summary.
- A hard preflight failure for missing Ollama may be too strict if lexical indexing should still proceed and embeddings can recover on a later pass.
- Early warnings should avoid being noisy when embeddings are disabled or when the provider is intentionally started later.

Open questions
- Should progress split into explicit phases such as file scan, extraction, embedding backlog, and embedding completion rather than a single indexed/skipped counter?
- Should symballist perform an embeddings-provider preflight only when embeddings are enabled, and should that be a warning or a blocking error?
- How should the console communicate that skipped files may still have pending or retryable embedding work?

Recommended next action
- Explore a small UX slice that makes index progress phase-aware and adds an early provider-availability signal when embeddings are enabled, without forcing a full reindex when connectivity is restored later.
<!-- SECTION:NOTES:END -->
