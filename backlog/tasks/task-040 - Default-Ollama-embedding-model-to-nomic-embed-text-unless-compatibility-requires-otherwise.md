---
id: TASK-040
title: >-
  Default Ollama embedding model to nomic-embed-text unless compatibility
  requires otherwise
status: Done
assignee: []
created_date: '2026-03-30 07:24'
updated_date: '2026-03-30 08:43'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current init output defaults `.symballist/config.json` to `embeddings.model: all-minilm`, while onboarding expectations and the README example point toward `nomic-embed-text:latest`. Based on manual macOS onboarding feedback, switch the default to `nomic-embed-text` unless there is a strong compatibility, availability, or performance reason not to. If a different default remains intentional, document that reason clearly and align the docs/config examples.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Init-generated config uses the intended default Ollama embedding model consistently
- [x] #2 README and onboarding docs match the actual generated default model
- [x] #3 If the default remains non-nomic, the docs explain the reason explicitly
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed the default Ollama embedding model in config generation to `nomic-embed-text:latest` and aligned the README/onboarding docs with the generated default, removing the earlier `all-minilm` mismatch.
<!-- SECTION:FINAL_SUMMARY:END -->
