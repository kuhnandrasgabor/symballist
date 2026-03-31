## Symballist Retrieval

Use the generated repo-local `symballist` tool definitions when your agent runtime has actually loaded them. Keep the repo-local CLI wrappers as the robust fallback.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- Preferred tool-definition manifest:
  - `.symballist\tools\symballist-tools.json`
- Tooling guide:
  - `.symballist\tools\README.md`
- Preferred tools:
  - `symballist_status`
  - `symballist_refresh`
  - `symballist_lookup`
  - `symballist_query`
  - `symballist_show`
- The JSON manifest existing on disk does not make `symballist_*` callable by itself.
- CLI fallback entrypoints:
  - PowerShell / cmd.exe: `.\.symballist\bin\symballist.cmd`
  - bash / zsh / sh: `./.symballist/bin/symballist`
- Mandatory first step: use `symballist_status` first or run `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>`.
- If the repo is stale, use `symballist_refresh` or run `.symballist\bin\symballist.cmd watch --once --root <PROJECT_ROOT>`.
- If auto-watch is already active, `watch --once` may return an already-fresh no-op. That is expected.
- If runtime tool loading is unavailable, use the CLI wrapper immediately instead of probing further.
- Prefer `symballist_lookup` when you want one selected best hit with context and alternatives.
- Use `symballist_query` / `symballist_show` when you want more manual ranked exploration or direct symbol inspection, or use the equivalent CLI commands if tool loading is unavailable.
- Query styles by goal:
  - exact symbol: `symballist_lookup`
  - fuzzy implementation concept: `symballist_query` with `--code-only --exclude-tests --prefer-implementation`
  - config path: `symballist_lookup`
  - CSS selector from a real stylesheet: `symballist_lookup`
  - known id or exact symbol inspection: `symballist_show`
- Consumers may rely on `path`, `file.path`, and `location.path` being present and equivalent in compact and non-compact flows.
- Treat `resultQuality.noStrongMatch: true` as a valid weak-result signal rather than a tool failure.
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
