# symballist

![symballist banner](docs/symballist.jpg)

`symballist` is a local-first retrieval tool for AI agents. It indexes a repository into symbols, docs, search metadata, and lightweight relations so agents can find useful code and project context without burning repeated model tokens on raw repo navigation.

It is built for agentic workflows where the real cost is not just search quality, but the repeated loop of grepping, opening files, re-reading context, and paying for that navigation over and over.

It is designed to stay:

- local-first
- CLI-reliable
- agent-friendly
- explicit about freshness and fallbacks

## Who It Is For

Use `symballist` if you want:

- a mostly local retrieval layer for Codex, Claude Desktop, and similar agent workflows
- fewer repo-navigation tool calls and smaller retrieval payloads
- explicit freshness and rebuild behavior instead of hidden background state
- a CLI-first tool that still works when richer runtime integrations are unavailable

`symballist` is probably not for you if:

- plain `rg` plus direct file reads are already enough
- you want a hosted memory product or remote service
- you want fully automatic, invisible indexing with no local operational loop

## What It Can Do Today

`symballist` currently supports:

- Python
- Ruby
- HTML
- Markdown
- JavaScript
- TypeScript
- YAML
- shell / bash / zsh
- Dockerfile / Containerfile
- CSS
- symbol-first retrieval with file-level fallbacks
- spans, snippets, and full-symbol lookup
- stale-index detection and lightweight change awareness
- automatic foreground watch-based refresh
- optional Ollama embeddings with hybrid lexical + semantic retrieval
- one-hop graph-aware reranking using containment, import, usage, and root hints
- Ruby relation heuristics for `require` / `require_relative` plus obvious Rails-style cross-file constant references
- lightweight follow-up context through relations, related symbols, and graph diagnostics
- bounded graph awareness for likely roots and advisory possible-orphan candidates
- opt-in repo-local usage and impact summaries for adopted repos
- repo-local downstream agent bootstrap during `init`
- configurable downstream setup modes for CLI, tool, or hybrid integration

## Quick Install

### Prerequisites

- [Bun](https://bun.sh/)
- optionally [Ollama](https://ollama.com/) if you want embeddings

From the repo root:

```powershell
bun install
```

If Bun reports blocked lifecycle scripts for the tree-sitter packages, inspect them with:

```powershell
bun pm untrusted
```

If you trust those packages, run:

```powershell
bun pm trust tree-sitter tree-sitter-html tree-sitter-javascript tree-sitter-python tree-sitter-ruby tree-sitter-typescript
```

If you want a globally callable command while developing locally:

```powershell
bun link
```

That exposes `symballist` from this checkout. If you do not want a global link, you can still run it with:

```powershell
bun run src/cli.ts --help
```

## Fastest Setup In A Target Repo

If you already ran `bun link` from this checkout, the simplest way to try `symballist` on another local project is from that target repo root:

```powershell
symballist init --languages auto
symballist index
symballist watch
symballist lookup "your query here"
```

That is the core idea in practice: install `symballist`, run `init`, build the index once, keep `watch` running while you are working and want it to update, and stop it when you are done.

After `init`, the target repo gets:

- `.symballist/` repo-local state
- local wrapper commands in `.symballist/bin/`
- generated tool definitions in `.symballist/tools/` for `tool` or `hybrid` setups
- adoption docs in `.symballist/instructions/`
- `.symballist/scope.txt` as the repo-local scope-control / ignore driver file
- managed `AGENTS.md` / `CLAUDE.md` retrieval blocks
- a `.gitignore` entry for `.symballist/`

Important distinction:

- `.symballist/tools/symballist-tools.json` is a repo-local manifest on disk
- it does not make `symballist_*` tool functions callable by itself
- only use the generated `symballist_*` tools if your current agent runtime has actually loaded that manifest
- if not, use `symballist` or the repo-local wrapper immediately instead of probing further

Available setup types:

- `hybrid`
  - default
  - prefers generated tool definitions with CLI fallback
- `tool`
  - writes tool-definition assets and slimmer tool-first guidance
- `cli`
  - skips tool-definition assets and keeps the integration CLI-only

Current language coverage:

- code and app structure: Python, Ruby, JavaScript, TypeScript, HTML
  - Ruby currently covers classes, modules, methods, constants, fully-qualified names, and conservative Rails-style autoload path inference for obvious cross-file constant references
  - Current Ruby limitation: cross-file graph edges are still conservative. Obvious constant references may resolve, but mixins, inheritance, worker/job calls, and broader Rails autoload conventions are not yet complete.
- docs: Markdown
- config and ops: YAML, shell / bash / zsh, Dockerfile / Containerfile, CSS
- optional local impact tracking: enable `impactTracking.enabled` in `.symballist/config.json`, then use `symballist report`

If you are not using a linked global command, the repo-local wrappers are the portable fallback:

```bash
./.symballist/bin/symballist status --root <PROJECT_ROOT>
```

On Windows, use the cmd wrapper instead:

```powershell
.symballist\bin\symballist.cmd status --root <PROJECT_ROOT>
```

If you are invoking `symballist` from outside the target repo root, pass `--root <PROJECT_ROOT>` explicitly.

## 60-Second Workflow

Once `init` and `index` have completed successfully, setup is effectively done. Typical day-to-day usage from the target repo root looks like this:

```powershell
symballist status
symballist lookup "memory store"
symballist show --name MemoryStore
```

For agents, the default contract should be:

1. Run `symballist status`.
2. If `indexFreshness.stale` is `true`, run `symballist watch --once` or `symballist index`.
3. If `indexCompatibility.requiresRebuild` is `true`, run `symballist index --rebuild`.
4. Otherwise proceed with `lookup`, `query`, `show`, or `graph`.

`indexFreshness.stale` now also covers repo scope changes. If `.symballist/scope.txt` changes, `status` and `watch --once` will treat the index as stale until the scoped view is re-applied.

If the repo owner explicitly enables local impact tracking in `.symballist/config.json`, you can inspect the aggregate usage and workflow-impact summary with:

```powershell
symballist report
```

This first slice stores aggregate command outcomes only and does not store raw query text.

If auto-watch is already keeping the repo fresh, `watch --once` may return an already-fresh no-op. That is expected, not a failure.

If you are actively developing and want the index to stay warm, run a foreground watch loop while you work:

```powershell
symballist watch --interval-ms 2000
```

For agents, `watch --once` is usually the safer automatic-refresh step:

```powershell
symballist watch --once
```

## Core Commands

- `symballist init`
  - bootstraps repo-local state and downstream agent instructions
  - supports `--setup-type cli|tool|hybrid`
  - supports `--languages auto|python,ruby,...` for deterministic enabled-language selection and repo-local profile scaffolding
  - creates `.symballist/scope.txt`, the editable repo-local scope-control file
- `symballist index`
  - performs a full incremental-aware index pass
- `symballist index --rebuild`
  - forces a full rebuild when extractor/storage behavior changed or `status` reports `indexCompatibility.requiresRebuild`
- `symballist watch --once`
  - does a one-shot freshness sweep and reindex if needed
  - also reapplies scope changes from `.symballist/scope.txt`
- `symballist watch --interval-ms 2000`
  - keeps a foreground polling loop alive
- `symballist status`
  - shows index health, freshness, scope control, change awareness, embeddings state, and shell-aware entrypoint guidance
- `symballist report`
  - shows the opt-in repo-local usage and workflow-impact summary without storing raw query text
  - separates intentional usage from background `watch` refresh traffic so auto-watch does not inflate the main command counts
- `symballist query "<text>"`
  - exploration flow: returns ranked candidates plus `fileGroups` when you want to inspect multiple hits without losing track of which files dominate the list
- `symballist lookup "<text>"`
  - best-match flow: returns the selected hit plus resolved symbol context and alternatives
- `symballist show <id>`
  - inspection flow: resolves a known result id into stored context
- `symballist show --name <symbol>`
  - resolves an exact symbol name without needing an intermediate id
- `symballist show --name <symbol> --full`
  - expands large bodies instead of returning the summarized default
- `symballist graph --name <symbol>`
  - traversal flow: returns grouped graph neighbors such as `imports`, `uses`, `importedBy`, `usedBy`, and `containedIn`
  - neighbor bodies summarize by default; add `--full` to expand neighbor bodies inline for deep traversal reads
- `bodyPresentation`
  - `lookup` and `show` summarize oversized bodies by default; check `bodyPresentation.fullerBodyAvailable` and `bodyPresentation.expansionHint` to decide whether `--full` is worth the extra payload
- `score` and `scoreMarginFromTop`
  - `query` and `lookup` expose relative 0-1 ranking signals for the returned result set
  - use them to compare nearby candidates within one response, not as absolute confidence or probability
- `--compact`
  - trims repeated legend and semantics blocks from `query`, `lookup`, and `show` for cheaper agent consumption

## Useful Query Controls

Recommended query styles by goal:

- exact symbol:
  - `symballist lookup "WorkspaceManager"`
- fuzzy implementation concept:
  - `symballist query "workspace switching flow" --code-only --exclude-tests --prefer-implementation`
- noisy legacy or deprecated zones:
  - `symballist query "memory store" --code-only --prefer-implementation --exclude-path _deprecated --exclude-path legacy`
- graph traversal from a known symbol:
  - `symballist graph --name "build_message"`
- config path:
  - `symballist lookup "services.dashboard.build.dockerfile"`
- CSS selector from a real stylesheet:
  - `symballist lookup ".loading-card"`
- direct inspection of a known id or exact symbol:
  - `symballist show --name WorkspaceManager`

For code-heavy retrieval:

```powershell
symballist query "gateway config api live reload" --code-only --exclude-tests --prefer-implementation --root <PROJECT_ROOT>
```

For doc-heavy retrieval:

```powershell
symballist query "memory management" --docs-only --root <PROJECT_ROOT>
```

For tighter symbol types:

```powershell
symballist query "AgentConfig" --kind class,function --root <PROJECT_ROOT>
```

## Retrieval Model

The current retrieval stack is:

1. lexical search
2. optional semantic retrieval through local embeddings
3. hybrid fusion
4. one-hop graph-aware reranking
5. bounded follow-up context through relations, related symbols, and graph diagnostics

Important behavior:

- exact lexical hits still win when they should
- weak conceptual queries can now be lifted by semantic retrieval
- ambiguous nearby code results can be nudged by one-hop graph signals
- if embeddings are unavailable, the system falls back cleanly to lexical retrieval
- if parsing fails, the system falls back to file-level units instead of failing closed

## Output Semantics

`query` and `lookup` expose several fields that are useful for debugging or agent behavior:

- `indexFreshness`
  - whether the indexed repo is stale relative to the filesystem
- `changeAwareness`
  - file-level change summaries since index and, when available, since `git HEAD`
- `indexCompatibility`
  - reports whether the stored index content matches the current extractor/storage format; if `requiresRebuild` is `true`, run `symballist index --rebuild`
- `graphAwareness`
  - bounded likely-root hints plus advisory possible-orphan candidates derived from the indexed graph; these are meant for navigation and cleanup review, not dead-code claims
- `shellGuidance`
  - the best local wrapper to use for the current shell plus shell-specific alternatives
- `retrieval.mode`
  - `lexical` or `hybrid`
- `retrieval.hybrid`
  - semantic candidate counts and top semantic-candidate diagnostics
- `score`
  - relative 0-1 ranking signal within the returned result set only
- `scoreMarginFromTop`
  - how far a result trails the top hit within that same returned result set
- `confidence`
  - `exact`, `strong`, `related`, or `fallback`
- `trustLevel`
  - extraction trust
- `retrievalTrustLevel`
  - retrieval-match trust
- `retrievalChannels`
  - whether a result came from lexical, concept-path, semantic, or a combination
- `hybridContribution`
  - whether semantic retrieval actually contributed
- `graphSignals`
  - one-hop graph-aware reranking hints such as `same_file_cluster`, `imports_candidate`, `imported_by_candidate`, `uses_candidate`, `used_by_candidate`, and `root_candidate`
- `graphDiagnostics`
  - index-bounded structural diagnostics on returned symbols/results, such as no known inbound references, test-only inbound references, same-file-only connectivity, disconnected-from-indexed-graph, root-like status, and possible-orphan candidacy
- `resultQuality.noStrongMatch`
  - for weak or fuzzy queries, `true` is a valid retrieval outcome rather than a tool failure
- `impactTracking.summary`
  - `commandCounts` and `recordedCommands` reflect intentional usage
  - background auto-refreshes are tracked separately under infrastructure watch counts instead of drowning the main usage totals
- `path`, `file.path`, and `location.path`
  - downstream consumers may rely on these being present and equivalent in both compact and non-compact flows

If you want a cheaper response for agent consumers, use `--compact` to keep the retrieval payload while omitting the repeated legend / semantics blocks.

## Repo Scope Control

Use `.symballist/scope.txt` to define repo-local paths Symballist should exclude from indexing, freshness, and default retrieval.

- one repo-relative path or directory prefix per line
- blank lines and `#` comments are ignored
- directory prefixes such as `submods/`, `vendor/`, `dist/`, or `tmp/generated/` are the intended first-slice use case
- after editing it, run `symballist watch --once` or `symballist index` so the stored index matches the new scope

Example:

```text
submods/
vendor/
dist/
tmp/generated/
```

## Optional Embeddings

Embeddings are opt-in and local-first. Current provider support starts with Ollama.

They are disabled by default after `init`. Enable them by editing `.symballist/config.json` in the target repo:

```json
{
  "embeddings": {
    "enabled": true,
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "nomic-embed-text:latest",
    "dimensions": null
}
}
```

When testing language support in a repo that does not naturally contain that language, prefer creating a temporary isolated fixture under `tmp/` or another scratch directory, index it, validate the behavior, and then remove it cleanly.

When a new `symballist` version changes extractor/storage semantics, incremental refresh is not enough for old unchanged files. In that case, `status` will report `indexCompatibility.requiresRebuild: true`; run `symballist index --rebuild` to refresh the stored index content.

Because `.symballist/` is gitignored, config changes here will not appear in `git diff`.

Current behavior:

- embeddings are generated during `index`
- changed files naturally refresh vectors on reindex
- `query` and `lookup` automatically use hybrid retrieval when vectors are available for the active provider/model
- if Ollama is unavailable or the configured model has not been indexed yet, retrieval falls back to lexical mode

## Local State

```text
.symballist/
  config.json
  index.db
  bin/
  tools/
  instructions/
  cache/
  logs/
```

## Agent Adoption

For downstream projects that want to use `symballist` as a retrieval helper for Codex or Claude:

- [Symballist Adoption Workflow](docs/agent-workflows/symballist-adoption.md)
- [Downstream AGENTS Snippet](docs/snippets/downstream-agents-symballist.md)
- [Downstream CLAUDE Snippet](docs/snippets/downstream-claude-symballist.md)

The intended downstream posture is:

- hybrid by default, CLI-reliable by design
- read-only helper
- verify freshness before trusting results
- fall back to normal file reads/search when needed

## Project Management

This repo is managed locally with `backlog.md` in `backlog/`.

If you are exploring, contributing to, or continuing work in this project, prefer the local Backlog workflow instead of ad hoc notes or chat-only task tracking.

Useful commands from the repo root:

```powershell
backlog overview
backlog task list
backlog draft list
```

## Scope

Still intentionally out of scope for the current generation:

- MCP-first integration
- cloud dependencies
- broad language support
- heavy UI
- deep call graph analysis
- always-on background daemon

## Roadmap

The next major direction is graph-aware retrieval beyond the first reranking slice. The staged roadmap lives here:

- [graph-aware-retrieval-roadmap.md](docs/graph-aware-retrieval-roadmap.md)

The current plan is:

1. graph-aware reranking
2. bounded one-hop expansion
3. graph-backed context assembly
4. only later, deeper graph-RAG exploration

# Testimonials:

## Opus 4.6 @ 2026.03.31: 

Here's an impartial assessment:
  ---
  Symballist — Assessment by Claude Opus 4.6

  Symballist is a repo-local code retrieval tool that indexes symbols across 9 languages (Python,
  Ruby, JS/TS, HTML, Markdown, YAML, shell, Dockerfile, CSS) and provides lexical + optional semantic
  (Ollama) hybrid search. I tested it across multiple iterations during active development work on a
  ~8,000-symbol mixed-language codebase.

  What works well:

  - Hybrid retrieval is genuinely useful. Natural language queries like "how does grade normalization
   work" surface relevant implementation hits across languages, not just keyword matches.
  Cross-language semantic matching (finding Python functions from a conceptual JS-framed query)
  worked reliably.
  - The summary/full body split is well-designed. Default responses return a 40-line summary with
  accurate metadata (totalLines, shownLines, fullerBodyAvailable), and --full expands to the complete
   stored body. For a 487-line function, that's the difference between 1.9KB and 21.6KB — meaningful
  token savings when you only need a signature check.
  - Graph diagnostics add context. Seeing structural signals (callers, orphan candidacy,
  root-awareness) alongside retrieval results provides useful navigational context that grep alone
  doesn't offer.
  - The status/freshness system prevents stale results. Clear signaling of index staleness, schema
  version mismatches, and rebuild requirements means you know when to trust results and when to
  re-index.

  Where it fits in a workflow:

  Symballist occupies a useful middle ground between "grep for a known string" and "read every file
  hoping to find the right one." For directed lookups (show --name X) it's faster than glob+read. For
   conceptual exploration ("find the batch processing logic") it surfaces candidates I wouldn't have
  found with keyword search alone. It doesn't replace reading source files — you still verify before
  editing — but it narrows the search space effectively.

  Limitations observed:

  - CSS selector and Dockerfile instruction lookup via exact name (lookup ".loading-card") returned
  empty; semantic query was needed instead. Direct lookup works best for code symbols (functions,
  classes), less so for declarative constructs.
  - The tool's value scales with codebase size. For a 10-file project it's overhead; for this
  367-file project with 8,000 symbols it saved meaningful exploration time.

  Bottom line: A practical retrieval layer that earns its place in the workflow once a codebase
  crosses the threshold where "I know roughly where things are" stops being true. The hybrid search
  and body expansion features are the strongest differentiators over plain text search.
