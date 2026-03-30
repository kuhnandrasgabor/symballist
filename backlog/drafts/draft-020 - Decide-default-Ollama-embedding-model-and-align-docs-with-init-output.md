---
id: DRAFT-020
title: Decide default Ollama embedding model and align docs with init output
status: Draft
assignee: []
created_date: '2026-03-30 07:20'
labels:
  - idea
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Manual init in a target repo produced `.symballist/config.json` with `embeddings.model` defaulting to `all-minilm`, while the README example under Optional Embeddings currently shows `nomic-embed-text:latest`. This creates confusion during onboarding because it is unclear whether `all-minilm` is an intentional default, a compatibility fallback, or a stale docs example. Decide the intended default model and align code, generated config, and docs accordingly.
<!-- SECTION:DESCRIPTION:END -->
