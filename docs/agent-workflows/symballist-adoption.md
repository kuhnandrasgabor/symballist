# Symballist Adoption Workflow

Use this workflow when another project wants to adopt `symballist` as a repo-local retrieval helper for AI agents.

## Purpose

The goal is to give agents a fast local discovery loop for code and docs without making `symballist` the sole source of truth.

Use it for:

- finding likely code symbols before opening files
- finding Markdown docs, plans, workflows, and architecture notes
- navigating common config and ops files such as YAML, shell scripts, Dockerfiles, and CSS
- resolving a search hit into full context with `show`
- checking whether the local index is fresh before trusting results
- optionally improving fuzzy or concept-heavy retrieval with local embeddings

Do not treat it as authoritative yet. Agents should use `symballist` to narrow the search space, then verify important details in the source files.

## Recommended Usage Model

- keep `symballist` CLI-reliable even when you add tool definitions
- use it as a read-only helper
- prefer explicit `--root <project-root>` targeting
- rerun `index` when the target repo is stale
- optionally enable local Ollama embeddings in `.symballist/config.json` when concept queries need more help
- fall back to normal file reads or search when results are weak or missing

`symballist init` now supports three downstream setup modes:

- `--setup-type hybrid`
  - default
  - generates repo-local tool definitions and keeps CLI wrappers as fallback
- `--setup-type tool`
  - generates tool-definition assets and tool-first managed guidance
- `--setup-type cli`
  - skips tool-definition assets and keeps the integration CLI-only

## Basic Loop

In `hybrid` or `tool` setups, the generated tool definitions live in:

```text
.symballist/tools/symballist-tools.json
```

The execution backend and universal fallback remains:

```text
.symballist/bin/symballist.cmd
```

Shell-aware local wrapper choices:

- PowerShell / cmd.exe:
  - `.\.symballist\bin\symballist.cmd`
- bash / zsh / sh:
  - `./.symballist/bin/symballist`

Preferred downstream entrypoint after `symballist init`:

```powershell
.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd index --root <PROJECT_ROOT>
.symballist\bin\symballist.cmd watch --once --root <PROJECT_ROOT>
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
symballist watch --once --root <PROJECT_ROOT>
symballist lookup "<text>" --root <PROJECT_ROOT>
symballist query "<text>" --root <PROJECT_ROOT>
symballist show <id> --root <PROJECT_ROOT>
symballist show --name <symbol> --root <PROJECT_ROOT>
symballist show --name <symbol> --full --root <PROJECT_ROOT>
```

Typical agent flow:

1. Run `status`.
2. If `indexFreshness.stale` is `true`, run `index`.
3. If you want a single command to sweep for stale files and reuse incremental indexing, run `watch --once`.
4. Use `lookup` when you want the one-shot best-match flow: one selected result, symbol context, and alternatives in one response.
5. Use `query` when you want ranked candidate exploration and plan to inspect multiple hits more manually.
6. Use `show` when you already know the symbol id or exact name and want direct inspection.
7. If `bodyPresentation.fullerBodyAvailable` is true, rerun `lookup` or `show` with `--full` to expand the complete stored body.
8. Verify important conclusions in the underlying file.
9. If embeddings are enabled, check the `retrieval` block from `query` or `lookup` to see whether the run was truly `hybrid` or fell back to lexical.
10. When debugging hybrid behavior, inspect `retrieval.hybrid` plus each result's `retrievalChannels`, `hybridContribution`, and `semanticSimilarity` fields to see whether embeddings actually contributed to the merged ranking.
11. In the current build, hybrid retrieval is no longer just informational: it can promote canonical implementation hits for weak conceptual queries when lexical overlap alone is not enough.
12. When inspecting why nearby code results clustered together, check `graphSignals` on each result to see whether one-hop file/import/usage structure or root-awareness contributed to reranking.
13. When you need a safer read on whether something merely looks isolated versus truly unused, inspect `graphDiagnostics` on the returned symbol or query results; these are bounded to what the current index can see.
14. When onboarding in a fresh shell, prefer the wrapper that matches the current shell instead of assuming the Windows `.cmd` entrypoint will work everywhere.
15. When the response is intended primarily for an agent consumer, prefer `--compact` on `query`, `lookup`, or `show` to avoid paying repeatedly for the static legend blocks.

Useful query refinements:

- use `--code-only --exclude-tests` when you want implementation-heavy results
- add `--prefer-implementation` when broad conceptual code queries still lean toward wiring or references; this now suppresses Markdown/doc noise and pushes implementation files more aggressively
- use `--docs-only` when you are explicitly looking for plans, workflows, or architecture notes; it now prefers canonical docs like `docs/`, `README.md`, and `plan.md` over duplicated operational mirrors
- use the `changeAwareness` block from `status` when you want a cheap answer to "what changed since the last index?" or, in git repos, "what changed since HEAD?"
- use the `graphAwareness.likelyRoots` block from `status` when you want a cheap answer to "what probably acts as a startup or entrypoint root in this repo?"
- use `watch --once` when you want a safe repo-local auto-refresh sweep without leaving a long-running process behind
- use `watch --interval-ms 2000` or similar only when you explicitly want a foreground polling loop while you work
- enable embeddings only if you already have a local Ollama endpoint and want better concept/fuzzy retrieval; lexical retrieval remains the default safety net

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

- [downstream-agents-symballist.md](../snippets/downstream-agents-symballist.md)
- [downstream-claude-symballist.md](../snippets/downstream-claude-symballist.md)

Copy the snippet that matches the target file, then replace `<PROJECT_ROOT>` with the repo you are integrating.
If you use `symballist init` in the target repo, these placeholders are filled automatically and the managed instruction blocks are updated for you.
The snippet files reflect the default `hybrid` posture; `cli` and `tool` setups are rendered by `init`.

## Notes

- `symballist` currently supports Python, HTML, Markdown, JavaScript, TypeScript, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS.
- optional embeddings currently start with Ollama via `.symballist/config.json`.
- For fast-moving repos, freshness matters as much as ranking quality.
- Prefer `hybrid` as the default setup. Keep CLI wrappers even when tool definitions are available so the integration stays portable across agent runtimes.
