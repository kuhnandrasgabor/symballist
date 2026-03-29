---
id: DRAFT-007
title: Improve Windows invocation UX and ship a real symballist command
status: Draft
assignee: []
created_date: '2026-03-28 16:47'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One agent hit a rough first-use issue on Windows: bun run with a backslash-heavy absolute path was easy to get wrong and failed poorly. This is not really a retrieval-quality issue; it is an adoption and ergonomics issue. Symballist would be easier to use across repos if agents could call a stable command name instead of remembering bun run <absolute-path> quirks.

Capture a draft for packaging and invocation polish on Windows and cross-repo use. The likely direction is to expose a first-class symballist command or wrapper with friendlier error messages for bad invocation forms.

User value:
- reduces first-call failure and onboarding friction
- makes downstream AGENTS.md / CLAUDE.md instructions shorter and more robust
- improves adoption by making symballist feel like a real tool rather than an internal script path

Observed motivation:
- agent explicitly reported bun run D:\Projects\symballist\src\cli.ts as a rough first-call failure with backslashes
- we have now started bootstrapping symballist into other repos, so invocation quality matters more than before
<!-- SECTION:DESCRIPTION:END -->
