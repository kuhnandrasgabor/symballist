---
id: DRAFT-025
title: Explore parallel Ollama embedding generation during indexing
status: Draft
assignee: []
created_date: '2026-03-31 20:50'
labels:
  - idea
  - spike
  - decision
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request: indexing semantics via Ollama is taking too long on macOS, and current behavior appears under-utilized across CPU cores. Explore how to reduce end-to-end embedding time during index runs without regressing stability or local-first operation.

Current code context: `src/commands/index.ts` processes files in a single awaited loop, and each files embeddable symbols are passed to `updateEmbeddingsForSymbols`. `src/embeddings.ts` then awaits a single `/api/embed` request before moving on. That makes embedding generation effectively serialized at the file level from symballists side, even if Ollama internally uses some parallelism.\n\nParallelization options to compare:\n- Add a bounded worker pool for file indexing plus embedding generation so multiple files can be read, parsed, and embedded concurrently.\n- Keep extraction serial but batch all pending embedding texts into a shared queue, then flush them through a bounded concurrent embed pipeline.\n- Add configurable embedding batch sizing and request concurrency so small files do not pay one-request-per-file overhead.\n- Split CPU-bound extraction from embedding I/O so parsing and Ollama requests can overlap instead of blocking one another.\n- Investigate whether Ollama-side settings or model/runtime limits on macOS are the real cap before adding aggressive client-side concurrency.\n\nTradeoffs to evaluate:\n- SQLite write contention and whether DB writes need a single-writer commit phase.\n- Memory pressure from large queued symbol bodies.\n- Diminishing returns if Ollama already saturates available compute with one large batch.\n- Whether concurrency should be disabled or lowered automatically when the local model/runtime becomes unstable.\n\nRecommended next action: run a short spike to benchmark current index timings, then prototype one bounded-concurrency path and one larger-batch path before choosing the default design.
<!-- SECTION:DESCRIPTION:END -->
