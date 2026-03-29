## Symballist Retrieval

Use the generated repo-local `symballist` tool definitions when your agent runtime can load them. Keep the repo-local CLI wrappers as the robust fallback.

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
- CLI fallback entrypoints:
  - PowerShell / cmd.exe: `.\.symballist\bin\symballist.cmd`
  - bash / zsh / sh: `./.symballist/bin/symballist`
- Use `symballist_status` first or run `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>`.
- If the repo is stale, use `symballist_refresh` or run `.symballist\bin\symballist.cmd watch --once --root <PROJECT_ROOT>`.
- Prefer `symballist_lookup` for the common `query -> top hit -> show` flow.
- Use `symballist_query` / `symballist_show` when you want more manual control, or use the equivalent CLI commands if tool loading is unavailable.
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
