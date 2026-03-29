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

Preferred downstream entrypoint after `symballist init`:

```powershell
.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd index --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd lookup "<text>" --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd query "<text>" --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd show <id> --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd show --name <symbol> --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd show --name <symbol> --full --root <PROJECT_ROOT>
```

If `symballist` has been installed or linked as a real command, that command name is also fine:

```powershell
symballist status --root <PROJECT_ROOT>
symballist index --root <PROJECT_ROOT>
symballist lookup "<text>" --root <PROJECT_ROOT>
symballist query "<text>" --root <PROJECT_ROOT>
symballist show <id> --root <PROJECT_ROOT>
symballist show --name <symbol> --root <PROJECT_ROOT>
symballist show --name <symbol> --full --root <PROJECT_ROOT>
```

Typical agent flow:

1. Run `status`.
2. If `indexFreshness.stale` is `true`, run `index`.
3. Use `lookup` when you want the common `query -> best hit -> show` flow in one response.
4. Use `query` and `show` separately when you want to inspect multiple candidates more manually.
5. If the symbol body is large, rerun `show` with `--full` to expand it.
6. Verify important conclusions in the underlying file.

Useful query refinements:

- use `--code-only --exclude-tests` when you want implementation-heavy results
- add `--prefer-implementation` when broad conceptual code queries still lean toward wiring or references; this now suppresses Markdown/doc noise and pushes implementation files more aggressively
- use `--docs-only` when you are explicitly looking for plans, workflows, or architecture notes; it now prefers canonical docs like `docs/`, `README.md`, and `plan.md` over duplicated operational mirrors
- use the `changeAwareness` block from `status` when you want a cheap answer to "what changed since the last index?" or, in git repos, "what changed since HEAD?"

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
