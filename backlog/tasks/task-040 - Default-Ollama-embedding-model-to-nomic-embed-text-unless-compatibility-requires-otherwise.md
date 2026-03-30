---
id: TASK-040
title: >-
  Default Ollama embedding model to nomic-embed-text unless compatibility
  requires otherwise
status: To Do
assignee: []
created_date: '2026-03-30 07:24'
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
- [ ] #1 Init-generated config uses the intended default Ollama embedding model consistently
- [ ] #2 README and onboarding docs match the actual generated default model
- [ ] #3 If the default remains non-nomic, the docs explain the reason explicitly
<!-- AC:END -->
