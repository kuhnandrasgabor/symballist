---
id: TASK-058
title: Clarify agent-runtime invocation contract for repo-local symballist tools
status: Done
assignee: []
created_date: '2026-03-31 08:42'
updated_date: '2026-03-31 08:49'
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
- [x] #1 Docs and generated guidance explicitly distinguish manifest presence from runtime callable tool availability.
- [x] #2 Invocation priority is explicit: if runtime tools are unavailable, agents should immediately use the repo-local CLI wrapper without extra probing.
- [x] #3 Guidance documents the mandatory status -> refresh-if-stale -> proceed flow and clarifies that watch --once can no-op when auto-watch already refreshed the repo.
- [x] #4 Guidance documents recommended query styles by goal and states the path/file.path/location.path consumer invariant.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated the shared guidance surfaces so agents can distinguish repo-local manifest presence from runtime tool availability and fall back immediately to the CLI wrapper when tools are not actually loaded. Tightened the README, adoption workflow, checked-in snippets, generated snippet/templates, tools README text, and CLI help around the mandatory status -> refresh-if-stale -> proceed contract, watch --once already-fresh no-op semantics, recommended query styles by goal, temporary scratch-fixture guidance for unsupported-language validation, and the path/file.path/location.path invariant for consumers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed README.md, src/cli.ts, src/fs.ts, docs/agent-workflows/symballist-adoption.md, docs/snippets/downstream-agents-symballist.md, and docs/snippets/downstream-claude-symballist.md so the invocation contract is explicit across repo docs, generated guidance, and CLI help. Verified with bun test (53 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
