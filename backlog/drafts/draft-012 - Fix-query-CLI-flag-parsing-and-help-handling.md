---
id: DRAFT-012
title: Fix query CLI flag parsing and help handling
status: Draft
assignee: []
created_date: '2026-03-28 17:38'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent downstream feedback found that `query --help` and `query --top 5` can reach the FTS layer instead of being handled as CLI flags, producing SQLite syntax errors like `fts5: syntax error near "-"`. Capture this as a dedicated robustness draft because it makes the tool feel brittle before retrieval quality even comes into play.

Expected direction:
- ensure query subcommand flags are parsed before any query text reaches FTS
- make `query --help` reliably render help instead of executing a search
- make unsupported flags fail cleanly with a user-facing CLI error instead of an internal SQL parse error
- decide whether `--top` should be a supported alias, or whether the tool should clearly steer users to `--limit`

User value:
- makes the CLI feel predictable and safe to explore
- prevents simple flag mistakes from looking like search-engine corruption
- reduces first-impression brittleness for downstream agents and users

Observed motivation:
- one agent reported both `query --help` and `query --top 5` breaking with FTS parse errors
- the same feedback explicitly called out this bug as the first thing to fix before deeper retrieval polish
<!-- SECTION:DESCRIPTION:END -->
