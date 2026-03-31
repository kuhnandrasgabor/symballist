## Symballist Retrieval

Use the generated repo-local `symballist` tool definitions when your runtime has actually loaded them, and fall back to the repo-local CLI wrappers when it cannot.

Current language coverage:
- Python, Ruby, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- Tool-definition manifest: `.symballist\tools\symballist-tools.json`
- Tooling guide: `.symballist\tools\README.md`
- The JSON manifest existing on disk does not make `symballist_*` callable by itself.
- CLI fallback entrypoints:
  - PowerShell / cmd.exe: `.\.symballist\bin\symballist.cmd`
  - bash / zsh / sh: `./.symballist/bin/symballist`
- Mandatory first step: start with `symballist_status` or `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>`.
- Refresh stale indexes with `symballist_refresh` or `.symballist\bin\symballist.cmd watch --once --root <PROJECT_ROOT>`.
- If `indexCompatibility.requiresRebuild` is true, run `.symballist\bin\symballist.cmd index --rebuild --root <PROJECT_ROOT>`.
- If `impactTracking.enabled` is true in `.symballist/config.json`, use the CLI fallback `.symballist\bin\symballist.cmd report --root <PROJECT_ROOT>` when you want the local aggregate usage and impact summary; it does not store raw query text.
- If auto-watch is already active, `watch --once` may return an already-fresh no-op. That is expected.
- If runtime tool loading is unavailable, use the CLI wrapper immediately instead of probing further.
- Prefer `symballist_lookup` when you want one selected best hit with context and alternatives.
- Use `symballist_query` and `symballist_show` when you need ranked exploration or direct symbol inspection.
- Use the CLI fallback `symballist report` only when you explicitly want the opt-in local usage and impact summary for this repo.
- In `report`, treat `commandCounts` as intentional usage and `infrastructureCommandCounts.watch` as background refresh traffic.
- Treat `resultQuality.noStrongMatch: true` as a valid weak-result signal rather than a tool failure.
- In `symballist_query` and `symballist_lookup`, use `score` and `scoreMarginFromTop` only as relative within-result-set ranking hints, not absolute confidence.
- Verify important conclusions in the source files before making changes.
- If `symballist` misses, use normal file search and direct reads.

Reference:
- `.symballist\instructions\symballist-adoption.md`
