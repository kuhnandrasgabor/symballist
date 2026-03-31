---
id: TASK-058
title: Clarify agent-runtime invocation contract for repo-local symballist tools
status: To Do
assignee: []
created_date: '2026-03-31 08:42'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tighten the README, generated instruction snippets, tooling docs, and help text so agents can clearly distinguish between repo-local tool-definition assets existing on disk and direct callable tool functions being available in the current runtime. Make the fallback order explicit, require a first-step status/check contract, clarify watch --once behavior when auto-watch already refreshed the index, document temporary-fixture guidance for unsupported-language validation, provide recommended query styles by goal, and state the path/file/location invariant that downstream consumers may rely on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Docs and generated guidance explicitly distinguish manifest presence from runtime callable tool availability.
- [ ] #2 Invocation priority is explicit: if runtime tools are unavailable, agents should immediately use the repo-local CLI wrapper without extra probing.
- [ ] #3 Guidance documents the mandatory status -> refresh-if-stale -> proceed flow and clarifies that watch --once can no-op when auto-watch already refreshed the repo.
- [ ] #4 Guidance documents recommended query styles by goal and states the path/file.path/location.path consumer invariant.
<!-- AC:END -->
