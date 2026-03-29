## Symballist Retrieval

Use `symballist` as a CLI-first read-only retrieval helper for this repo.

- Check freshness first:
  - `bun run <SYMBALLIST_ROOT>\src\cli.ts status --root <PROJECT_ROOT>`
- If the index is stale, refresh it before relying on results:
  - `bun run <SYMBALLIST_ROOT>\src\cli.ts index --root <PROJECT_ROOT>`
- Use query for discovery:
  - `bun run <SYMBALLIST_ROOT>\src\cli.ts query "<text>" --root <PROJECT_ROOT>`
- Use show for full context and related symbols:
  - `bun run <SYMBALLIST_ROOT>\src\cli.ts show <id> --root <PROJECT_ROOT>`
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
