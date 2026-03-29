# Symballist Adoption Workflow

Use this workflow when another project wants to adopt `symballist` as a CLI-first retrieval helper for AI agents.

## Purpose

The goal is to give agents a fast local discovery loop for code and docs without making `symballist` the sole source of truth.

Use it for:

- finding likely code symbols before opening files
- finding Markdown docs, plans, workflows, and architecture notes
- resolving a search hit into full context with `show`
- checking whether the local index is fresh before trusting results

Do not treat it as authoritative yet. Agents should use `symballist` to narrow the search space, then verify important details in the source files.

## Recommended Usage Model

- keep `symballist` CLI-first
- use it as a read-only helper
- prefer explicit `--root <project-root>` targeting
- rerun `index` when the target repo is stale
- fall back to normal file reads or search when results are weak or missing

## Basic Loop

From anywhere, using the `symballist` CLI entrypoint:

```powershell
bun run <SYMBALLIST_ROOT>\src\cli.ts status --root <PROJECT_ROOT>
bun run <SYMBALLIST_ROOT>\src\cli.ts index --root <PROJECT_ROOT>
bun run <SYMBALLIST_ROOT>\src\cli.ts query "<text>" --root <PROJECT_ROOT>
bun run <SYMBALLIST_ROOT>\src\cli.ts show <id> --root <PROJECT_ROOT>
```

Typical agent flow:

1. Run `status`.
2. If `indexFreshness.stale` is `true`, run `index`.
3. Run `query` with a focused phrase or symbol name.
4. Run `show` on the best hit to inspect full context plus related symbols.
5. Verify important conclusions in the underlying file.

## When Agents Should Use It

Good triggers:

- "find where this config/model/class is defined"
- "find the docs or workflow for X"
- "where is this architecture decision described"
- "show me the likely entry points for this feature"

Skip it or fall back quickly when:

- the repo has not been indexed and indexing is not appropriate right now
- the result set is empty or obviously noisy
- the user already provided the exact file to inspect
- the work requires exact current file contents and the index is stale

## Downstream Snippets

Use these dedicated snippet files as the canonical copy-paste source for downstream projects:

- [downstream-agents-symballist.md](/D:/Projects/symballist/docs/snippets/downstream-agents-symballist.md)
- [downstream-claude-symballist.md](/D:/Projects/symballist/docs/snippets/downstream-claude-symballist.md)

Copy the snippet that matches the target file, then replace `<PROJECT_ROOT>` with the repo you are integrating.
If you use `symballist init` in the target repo, these placeholders are filled automatically and the managed instruction blocks are updated for you.

## Notes

- `symballist` currently works best as a helper for Python, HTML, and Markdown.
- For fast-moving repos, freshness matters as much as ranking quality.
- Start with CLI-only adoption. Defer MCP or deeper tool integration until the workflow is stable.
