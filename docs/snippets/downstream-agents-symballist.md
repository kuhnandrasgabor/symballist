## Symballist Retrieval

Use `symballist` as a CLI-first read-only retrieval helper for this repo.

- Preferred local entrypoint:
  - `.symballist\bin\symballist.cmd`
- If `symballist` is installed globally or linked, that command name is also acceptable.
- Check freshness first:
  - `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>`
- If the index is stale, refresh it before relying on results:
  - `.symballist\bin\symballist.cmd index --root <PROJECT_ROOT>`
- Use query for discovery:
  - `.symballist\bin\symballist.cmd query "<text>" --root <PROJECT_ROOT>`
- Use show for full context and related symbols:
  - `.symballist\bin\symballist.cmd show <id> --root <PROJECT_ROOT>`
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
