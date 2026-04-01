# Symballist Adoption Workflow

Use this workflow when another project wants to adopt `symballist` as a repo-local retrieval helper for AI agents.

## Purpose

The goal is to give agents a fast local discovery loop for code and docs without making `symballist` the sole source of truth.

Use it for:

- finding likely code symbols before opening files
- finding Markdown docs, plans, workflows, and architecture notes
- navigating common config and ops files such as YAML, shell scripts, Dockerfiles, and CSS
- finding Ruby classes, modules, methods, and constants in Rails or Canvas-style repos, including obvious Rails-style cross-file constant targets when the file path is unambiguous
- resolving a search hit into full context with `show`
- checking whether the local index is fresh before trusting results
- optionally improving fuzzy or concept-heavy retrieval with local embeddings

Do not treat it as authoritative yet. Agents should use `symballist` to narrow the search space, then verify important details in the source files.

## Recommended Usage Model

- keep `symballist` CLI-reliable even when you add tool definitions
- use it as a read-only helper
- prefer explicit `--root <project-root>` targeting
- rerun `index` when the target repo is stale
- use `.symballist/scope.txt` when the repo needs persistent path scoping for vendored, generated, archived, or third-party zones
- optionally enable local Ollama embeddings in `.symballist/config.json` when concept queries need more help
- optionally enable `impactTracking.enabled` in `.symballist/config.json` when you want a local aggregate usage and workflow-impact summary via `symballist report`
- fall back to normal file reads or search when results are weak or missing

Important distinction:

- `.symballist/tools/symballist-tools.json` is a repo-local manifest on disk
- it does not make `symballist_*` directly callable by itself
- only use the generated tool names if your current runtime has actually loaded that manifest
- if not, use the repo-local CLI wrapper immediately instead of probing further

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
2. If `indexFreshness.stale` is `true`, run `watch --once` or `index`.
3. If `indexCompatibility.requiresRebuild` is `true`, run `index --rebuild` before trusting unchanged indexed files.
4. If `.symballist/scope.txt` changed, that also counts as stale until `watch --once` or `index` reapplies the scoped view.
4. If auto-watch is already active, `watch --once` may return an already-fresh no-op. That is expected.
5. Use `lookup` when you want the one-shot best-match flow: one selected result, symbol context, and alternatives in one response.
6. Use `query` when you want ranked candidate exploration and plan to inspect multiple hits more manually.
7. Use `show` when you already know the symbol id or exact name and want direct inspection.
8. If `bodyPresentation.fullerBodyAvailable` is true, rerun `lookup` or `show` with `--full` to expand the complete stored body.
9. If the repo owner enabled `impactTracking.enabled`, use `report` only when you explicitly want the local aggregate usage and impact summary; it does not store raw query text.
10. In `query` and `lookup`, use `score` and `scoreMarginFromTop` only as relative within-result-set ranking hints, not as absolute confidence values.
11. In `report`, treat `commandCounts` as intentional usage and background `watch` traffic as separate infrastructure counts.
12. Verify important conclusions in the underlying file.
13. If embeddings are enabled, check the `retrieval` block from `query` or `lookup` to see whether the run was truly `hybrid` or fell back to lexical.
14. When debugging hybrid behavior, inspect `retrieval.hybrid` plus each result's `retrievalChannels`, `hybridContribution`, and `semanticSimilarity` fields to see whether embeddings actually contributed to the merged ranking.
15. In the current build, hybrid retrieval is no longer just informational: it can promote canonical implementation hits for weak conceptual queries when lexical overlap alone is not enough.
16. When inspecting why nearby code results clustered together, check `graphSignals` on each result to see whether one-hop file/import/usage structure or root-awareness contributed to reranking.
17. When you need a safer read on whether something merely looks isolated versus truly unused, inspect `graphDiagnostics` on the returned symbol or query results; these are bounded to what the current index can see.
18. When onboarding in a fresh shell, prefer the wrapper that matches the current shell instead of assuming the Windows `.cmd` entrypoint will work everywhere.
19. When the response is intended primarily for an agent consumer, prefer `--compact` on `query`, `lookup`, or `show` to avoid paying repeatedly for the static legend blocks.

Useful query refinements:

- exact symbol:
  - `lookup "WorkspaceManager"`
- fuzzy implementation concept:
  - `query "workspace switching flow" --code-only --exclude-tests --prefer-implementation`
- noisy legacy or deprecated zones:
  - `query "memory store" --code-only --prefer-implementation --exclude-path _deprecated --exclude-path legacy`
- config path:
  - `lookup "services.dashboard.build.dockerfile"`
- CSS selector from a real stylesheet:
  - `lookup ".loading-card"`
- known id or exact symbol inspection:
  - `show --name WorkspaceManager`
- deep graph traversal read:
  - `graph --name "build_message" --full`
- use `--code-only --exclude-tests` when you want implementation-heavy results
- check `fileGroups` on query responses when several hits come from the same file and you want a cheap grouped view without giving up symbol-level results
- add one or more `--exclude-path <fragment>` flags when legacy, deprecated, generated, or vendor directories are polluting the result set
- use `.symballist/scope.txt` when those noisy paths are persistent repo structure rather than one-off query cleanup
- add `--prefer-implementation` when broad conceptual code queries still lean toward wiring or references; this now suppresses Markdown/doc noise and pushes implementation files more aggressively
- use `--docs-only` when you are explicitly looking for plans, workflows, or architecture notes; it now prefers canonical docs like `docs/`, `README.md`, and `plan.md` over duplicated operational mirrors
- use the `changeAwareness` block from `status` when you want a cheap answer to "what changed since the last index?" or, in git repos, "what changed since HEAD?"
- use the `indexCompatibility` block from `status` when you want to know whether extractor/storage behavior changed enough to require `index --rebuild`
- use the `graphAwareness.likelyRoots` block from `status` when you want a cheap answer to "what probably acts as a startup or entrypoint root in this repo?"
- use the `graphAwareness.possibleOrphans` block from `status` when you want a bounded list of cleanup candidates that currently have no known inbound references and are not root-like
- use `watch --once` when you want a safe repo-local auto-refresh sweep without leaving a long-running process behind
- use `watch --interval-ms 2000` or similar only when you explicitly want a foreground polling loop while you work
- enable embeddings only if you already have a local Ollama endpoint and want better concept/fuzzy retrieval; lexical retrieval remains the default safety net
- treat `resultQuality.noStrongMatch: true` as an explicit weak-result outcome rather than a tool failure
- use `score` and `scoreMarginFromTop` only as relative ranking hints within one returned result set
- in `report`, read `commandCounts` as intentional usage and treat watch refreshes as separate infrastructure traffic
- downstream consumers may rely on `path`, `file.path`, and `location.path` being present and equivalent in compact and non-compact flows
- if the repo lacks a language you want to validate, create a temporary isolated fixture under `tmp/` or another scratch directory, index it, validate the behavior, and then remove it

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

- `symballist` currently supports Python, Ruby, HTML, Markdown, JavaScript, TypeScript, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS.
- Ruby support includes fully-qualified symbol lookup plus conservative cross-file relation inference for obvious autoloaded constants; it is still lighter than a full Rails call graph.
- Expect Ruby graph connectivity to stay conservative for now: `include` / `extend`, inheritance, worker-job calls, and broader Rails autoload resolution are not complete yet, so verify important cross-file conclusions in source.
- `.symballist/scope.txt` is the persistent repo-level scope-control file for indexing, freshness, and default retrieval; prefer it over hardcoded path assumptions when a repo has vendored or third-party zones.
- optional embeddings currently start with Ollama via `.symballist/config.json`.
- For fast-moving repos, freshness matters as much as ranking quality.
- Prefer `hybrid` as the default setup. Keep CLI wrappers even when tool definitions are available so the integration stays portable across agent runtimes.
