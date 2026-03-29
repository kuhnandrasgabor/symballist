# symballist

`symballist` is a local-first retrieval tool for AI agents. It indexes a repository into symbols, docs, search metadata, and lightweight relations so agents can find useful code and project context faster than plain text search alone.

It is designed to stay:

- local-first
- CLI-first
- agent-friendly
- explicit about freshness and fallbacks

## What It Can Do Today

`symballist` currently supports:

- Python, HTML, and Markdown indexing
- symbol-first retrieval with file-level fallbacks
- spans, snippets, and full-symbol lookup
- stale-index detection and lightweight change awareness
- automatic foreground watch-based refresh
- optional Ollama embeddings with hybrid lexical + semantic retrieval
- one-hop graph-aware reranking using containment/import neighborhoods
- lightweight follow-up context through relations and related symbols
- repo-local downstream agent bootstrap during `init`

## Quick Install

### Prerequisites

- [Bun](https://bun.sh/)
- optionally [Ollama](https://ollama.com/) if you want embeddings

From the repo root:

```powershell
bun install
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

The simplest way to try `symballist` on another local project is:

```powershell
symballist init --root D:\Projects\your-repo
symballist index --root D:\Projects\your-repo
symballist lookup "your query here" --root D:\Projects\your-repo
```

After `init`, the target repo gets:

- `.symballist/` repo-local state
- local wrapper commands in `.symballist/bin/`
- adoption docs in `.symballist/instructions/`
- managed `AGENTS.md` / `CLAUDE.md` retrieval blocks
- a `.gitignore` entry for `.symballist/`

If you prefer the repo-local wrapper instead of a linked global command:

```powershell
.symballist\bin\symballist.cmd status --root D:\Projects\your-repo
```

## 60-Second Workflow

Typical usage looks like this:

```powershell
symballist status --root D:\Projects\your-repo
symballist index --root D:\Projects\your-repo
symballist lookup "memory store" --root D:\Projects\your-repo
symballist show --name MemoryStore --root D:\Projects\your-repo
```

Or, if you want a foreground auto-refresh loop while you work:

```powershell
symballist watch --interval-ms 2000 --root D:\Projects\your-repo
```

For agents, `watch --once` is usually the safer automatic-refresh step:

```powershell
symballist watch --once --root D:\Projects\your-repo
```

## Core Commands

- `symballist init`
  - bootstraps repo-local state and downstream agent instructions
- `symballist index`
  - performs a full incremental-aware index pass
- `symballist watch --once`
  - does a one-shot freshness sweep and reindex if needed
- `symballist watch --interval-ms 2000`
  - keeps a foreground polling loop alive
- `symballist status`
  - shows index health, freshness, change awareness, and embeddings state
- `symballist query "<text>"`
  - returns ranked candidates
- `symballist lookup "<text>"`
  - returns the top hit plus resolved symbol context and alternatives
- `symballist show <id>`
  - resolves a result id into full stored context
- `symballist show --name <symbol>`
  - resolves an exact symbol name without needing an intermediate id
- `symballist show --name <symbol> --full`
  - expands large bodies instead of returning the summarized default

## Useful Query Controls

For code-heavy retrieval:

```powershell
symballist query "gateway config api live reload" --code-only --exclude-tests --prefer-implementation --root D:\Projects\your-repo
```

For doc-heavy retrieval:

```powershell
symballist query "memory management" --docs-only --root D:\Projects\your-repo
```

For tighter symbol types:

```powershell
symballist query "AgentConfig" --kind class,function --root D:\Projects\your-repo
```

## Retrieval Model

The current retrieval stack is:

1. lexical search
2. optional semantic retrieval through local embeddings
3. hybrid fusion
4. one-hop graph-aware reranking
5. bounded follow-up context through relations and related symbols

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
- `retrieval.mode`
  - `lexical` or `hybrid`
- `retrieval.hybrid`
  - semantic candidate counts and top semantic-candidate diagnostics
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
  - one-hop graph-aware reranking hints such as `same_file_cluster`, `imports_candidate`, and `imported_by_candidate`

## Optional Embeddings

Embeddings are opt-in and local-first. Current provider support starts with Ollama.

Enable them in `.symballist/config.json`:

```json
{
  "embeddings": {
    "enabled": true,
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "all-minilm",
    "dimensions": null
  }
}
```

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
  instructions/
  cache/
  logs/
```

## Agent Adoption

For downstream projects that want to use `symballist` as a retrieval helper for Codex or Claude:

- [Symballist Adoption Workflow](/D:/Projects/symballist/docs/agent-workflows/symballist-adoption.md)
- [Downstream AGENTS Snippet](/D:/Projects/symballist/docs/snippets/downstream-agents-symballist.md)
- [Downstream CLAUDE Snippet](/D:/Projects/symballist/docs/snippets/downstream-claude-symballist.md)

The intended downstream posture is:

- CLI-first
- read-only helper
- verify freshness before trusting results
- fall back to normal file reads/search when needed

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

- [graph-aware-retrieval-roadmap.md](/D:/Projects/symballist/docs/graph-aware-retrieval-roadmap.md)

The current plan is:

1. graph-aware reranking
2. bounded one-hop expansion
3. graph-backed context assembly
4. only later, deeper graph-RAG exploration
