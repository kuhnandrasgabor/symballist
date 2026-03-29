## Symballist Retrieval

Use `symballist` as a CLI-first read-only retrieval helper for this repo.

- Run `bun run D:\Projects\symballist\src\cli.ts status --root <PROJECT_ROOT>` before trusting older results.
- If `indexFreshness.stale` is true, run `bun run D:\Projects\symballist\src\cli.ts index --root <PROJECT_ROOT>`.
- Use `query` to discover relevant code or docs.
- Use `show` to inspect a result with full body, spans, relations, and related symbols.
- Verify important conclusions in the source files before making changes.
- If `symballist` misses, use normal file search and direct reads.

Reference:
- `D:\Projects\symballist\docs\agent-workflows\symballist-adoption.md`
