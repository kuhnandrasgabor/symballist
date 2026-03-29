## Symballist Retrieval

Use `symballist` as a CLI-first read-only retrieval helper for this repo.

- Preferred local entrypoint: `.symballist\bin\symballist.cmd`
- If `symballist` is installed globally or linked, that command name is also acceptable.
- Run `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>` before trusting older results.
- If `indexFreshness.stale` is true, run `.symballist\bin\symballist.cmd index --root <PROJECT_ROOT>`.
- Use `query` to discover relevant code or docs.
- Use `show` to inspect a result with full body, spans, relations, and related symbols.
- If you already know the symbol, use `.symballist\bin\symballist.cmd show --name <symbol> --root <PROJECT_ROOT>`.
- Verify important conclusions in the source files before making changes.
- If `symballist` misses, use normal file search and direct reads.

Reference:
- `.symballist\instructions\symballist-adoption.md`
