## Symballist Retrieval

Use `symballist` as a CLI-first read-only retrieval helper for this repo.

- Preferred local entrypoint: `.symballist\bin\symballist.cmd`
- If `symballist` is installed globally or linked, that command name is also acceptable.
- Run `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>` before trusting older results.
- Use the `changeAwareness` block from `status` when you want a cheap answer to what changed since the last index or, in git repos, since `HEAD`.
- If `indexFreshness.stale` is true, run `.symballist\bin\symballist.cmd index --root <PROJECT_ROOT>`.
- Use `.symballist\bin\symballist.cmd lookup "<text>" --root <PROJECT_ROOT>` for the common `query -> top hit -> show` flow.
- Use `query` to discover relevant code or docs.
- Add `--code-only --exclude-tests` for implementation-heavy results.
- Add `--prefer-implementation` when broad code queries still lean toward wiring or references.
- Add `--docs-only` when you are explicitly looking for workflows, plans, or architecture notes.
- Use `show` to inspect a result with full body, spans, relations, and related symbols.
- If you already know the symbol, use `.symballist\bin\symballist.cmd show --name <symbol> --root <PROJECT_ROOT>`.
- If the symbol body is large, use `.symballist\bin\symballist.cmd show --name <symbol> --full --root <PROJECT_ROOT>`.
- Verify important conclusions in the source files before making changes.
- If `symballist` misses, use normal file search and direct reads.

Reference:
- `.symballist\instructions\symballist-adoption.md`
