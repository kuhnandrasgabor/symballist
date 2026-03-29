---
id: TASK-013
title: Fix query CLI flag parsing and help handling
status: Done
assignee: []
created_date: '2026-03-28 17:38'
updated_date: '2026-03-28 17:45'
labels: []
dependencies: []
priority: high
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a command-aware CLI parser so query subcommand flags are handled before any search text reaches FTS.

What changed
- added explicit subcommand help handling via runCli and command-specific usage output
- parseCliArgs now tracks help requests and returns clean CLI errors for unknown options instead of treating them as query text
- query now supports --top as an alias for --limit, which matches recent downstream expectations and avoids raw flag text reaching SQLite
- show and query now consume only post-command positionals, which keeps subcommand argument handling predictable

Verification
- bun test passes (15 tests)
- bun run src/cli.ts query --help prints query usage
- bun run src/cli.ts query --top 5 greet no longer throws an FTS syntax error
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the CLI parsing/help path that was causing query flags like --help and --top to leak into SQLite FTS. Query help now renders normally, unsupported flags are handled at the CLI layer, and --top is supported as a limit alias for downstream ergonomics.
<!-- SECTION:FINAL_SUMMARY:END -->
