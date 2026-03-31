## Symballist Retrieval

Use the generated repo-local `symballist` tool definitions when your runtime can load them, and fall back to the repo-local CLI wrappers when it cannot.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- Tool-definition manifest: `.symballist\tools\symballist-tools.json`
- Tooling guide: `.symballist\tools\README.md`
- CLI fallback entrypoints:
  - PowerShell / cmd.exe: `.\.symballist\bin\symballist.cmd`
  - bash / zsh / sh: `./.symballist/bin/symballist`
- Start with `symballist_status` or `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>`.
- Refresh stale indexes with `symballist_refresh` or `.symballist\bin\symballist.cmd watch --once --root <PROJECT_ROOT>`.
- Prefer `symballist_lookup` when you want one selected best hit with context and alternatives.
- Use `symballist_query` and `symballist_show` when you need ranked exploration or direct symbol inspection.
- Verify important conclusions in the source files before making changes.
- If `symballist` misses, use normal file search and direct reads.

Reference:
- `.symballist\instructions\symballist-adoption.md`
