---
id: DRAFT-028
title: Explore handling embedding input context-length failures during indexing
status: Draft
assignee: []
created_date: '2026-04-01 05:29'
labels:
  - idea
  - bug
  - spike
  - decision
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Indexing can currently fail semantic embedding generation with errors like `Embedding request failed (400): {"error":"the input length exceeds the context length"}`. The current embedding path in `src/embeddings.ts` builds payloads by trimming to a fixed line and character budget, but it does not budget against model token/context limits and sends all symbol texts for a file in one `/api/embed` request. That means large symbol bodies or unlucky batches can still exceed the active models input window.

This needs exploration before implementation because there are multiple plausible policies with different retrieval and ops tradeoffs: stricter per-symbol truncation, token-aware budgeting, request chunking by symbol batch, skipping or degrading oversized symbols while continuing the rest of the index, or provider/model-specific limits surfaced in config/status. The main user value is to keep indexing resilient and predictable when embeddings are enabled, without silently failing an entire semantic pass because one request is too large.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Intake summary
- Reported failure: embedding request returns 400 with `the input length exceeds the context length`.
- Current code context: `buildEmbeddingText` caps lines/chars, but not tokens; `updateEmbeddingsForSymbols` embeds every symbol text for a file in one call; `runIndex` stores a single `embeddingError` string and then stops further embedding attempts after the first failure.

Related backlog items
- DRAFT-025 overlaps on embedding throughput and batch sizing, but its focus is performance/concurrency rather than correctness under provider context limits.
- TASK-059 overlaps indirectly because fuller stored symbol bodies increase the chance that embedding payloads need their own separate bounding policy.
- TASK-028 is the completed umbrella for optional embeddings, but this failure mode is not captured there.

Potential conflicts
- More aggressive truncation may hurt retrieval quality for large implementation symbols.
- Per-request chunking or retries may improve resilience but change indexing latency and provider load.
- Provider-specific token estimation may be hard to keep honest if the active local model changes.

Open questions
- Should one oversized symbol be skipped, truncated further, or split, and how visible should that be in status/stats?
- Should batching be bounded by estimated tokens, symbol count, bytes, or some combination?
- Should query-time embedding requests adopt the same budgeting path for long natural-language prompts?
- Is the right first slice a resilient fallback policy rather than exact token accounting?

Recommended next action
- Create a focused draft and decide the smallest resilient policy that prevents one context-limit failure from disabling all remaining embeddings in an index run.
<!-- SECTION:NOTES:END -->
