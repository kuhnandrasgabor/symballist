## Symballist Retrieval

Use `symballist` as a CLI-first read-only retrieval helper for this repo.

- Preferred local entrypoint:
  - `.symballist\bin\symballist.cmd`
- If `symballist` is installed globally or linked, that command name is also acceptable.
- Check freshness first:
  - `.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>`
- Use the `changeAwareness` block from `status` when you want a cheap answer to what changed since the last index or, in git repos, since `HEAD`.
- Use the `embeddings` block from `status` when you want to know whether hybrid retrieval is configured and available for the active model.
- If the index is stale, refresh it before relying on results:
  - `.symballist\bin\symballist.cmd index --root <PROJECT_ROOT>`
- If you want a one-shot freshness sweep that automatically reuses incremental indexing:
  - `.symballist\bin\symballist.cmd watch --once --root <PROJECT_ROOT>`
- Use lookup for the common `query -> top hit -> show` flow:
  - `.symballist\bin\symballist.cmd lookup "<text>" --root <PROJECT_ROOT>`
- If embeddings are enabled, inspect the `retrieval` block from `query` or `lookup` to see whether the run was truly `hybrid` or fell back to lexical.
- Use query for discovery:
  - `.symballist\bin\symballist.cmd query "<text>" --root <PROJECT_ROOT>`
  - Add `--code-only --exclude-tests` for implementation-heavy results.
  - Add `--prefer-implementation` when broad code queries still lean toward wiring or references.
  - Add `--docs-only` when you are explicitly looking for workflows, plans, or architecture notes.
- Use show for full context and related symbols:
  - `.symballist\bin\symballist.cmd show <id> --root <PROJECT_ROOT>`
  - `.symballist\bin\symballist.cmd show --name <symbol> --root <PROJECT_ROOT>`
  - `.symballist\bin\symballist.cmd show --name <symbol> --full --root <PROJECT_ROOT>`
- Only run `.symballist\bin\symballist.cmd watch --interval-ms 2000 --root <PROJECT_ROOT>` when you explicitly want a foreground polling loop while you work.
- Optional embeddings currently start with Ollama and are configured in `.symballist\config.json`.
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
