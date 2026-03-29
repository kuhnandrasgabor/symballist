# symballist

symballist is a local-first code retrieval tool for AI agents. It indexes a repository into symbols, search metadata, and lightweight relationships so agents can search codebases faster and with more structure than plain text search alone.

## V1

V1 is intentionally narrow:

- agent-first retrieval
- CLI-first workflow
- Python, HTML, and Markdown
- repo-local state in `.symballist/`
- symbol-first indexing with file-level fallback
- SQLite + FTS lexical search
- optional Ollama embeddings for hybrid retrieval
- incremental reindexing for changed files
- rich query results with symbol spans and snippets
- stale-index detection in status and retrieval commands
- lightweight import and containment relations in show output
- relation-aware symbol expansion in show output for fast local follow-up context
- Markdown heading indexing with file-level fallback for docs

## Query Pipeline

The retrieval flow is:

1. lexical search
2. embedding similarity, if embeddings are available in a later slice
3. rank fusion
4. lightweight graph expansion

The graph layer should stay simple in v1:

- file containment
- imports
- cheap references where available

symballist should never fail closed. If parsing fails, fall back to file-level units. If embeddings are missing or stale, fall back to lexical plus structure. If graph links are sparse, still return ranked symbols.

## Principles

- local-first
- agent-first
- CLI-first
- symbol-aware
- explicit fallbacks
- narrow, working first slice

## Out Of Scope For V1

- MCP integration
- cloud dependencies
- broad language support
- heavy UI
- deep call graph analysis
- always-on indexing daemon

## Rough CLI Surface

- `symballist init`
  - creates `.symballist/`
  - ensures `.gitignore` contains `.symballist/`
  - copies local adoption docs/snippets into `.symballist/instructions/`
  - writes local wrapper commands into `.symballist/bin/`
  - creates or refreshes managed `AGENTS.md` and `CLAUDE.md` symballist retrieval blocks
- `symballist index`
- `symballist watch --once`
- `symballist watch --interval-ms 2000`
- `symballist status`
- `symballist lookup "<text>" --code-only --exclude-tests --prefer-implementation`
- `symballist query "<text>" --kind class,function`
- `symballist query "<text>" --code-only --exclude-tests --prefer-implementation`
- `symballist query "<text>" --docs-only`
- `symballist show <id>`
- `symballist show --name <symbol>`
- `symballist show --name <symbol> --full`

## Agent Adoption

For downstream projects that want to use `symballist` as a CLI-first retrieval helper for Codex or Claude, see [Symballist Adoption Workflow](/D:/Projects/symballist/docs/agent-workflows/symballist-adoption.md).
Reusable downstream instruction snippets live in [downstream AGENTS snippet](/D:/Projects/symballist/docs/snippets/downstream-agents-symballist.md) and [downstream CLAUDE snippet](/D:/Projects/symballist/docs/snippets/downstream-claude-symballist.md).

`--prefer-implementation` is intended for code-oriented queries. When used outside `--docs-only`, it now suppresses Markdown/doc noise and pushes `src/` implementations harder so the flag produces a visible ranking change.
`--docs-only` now prefers canonical docs like `docs/`, `README.md`, and `plan.md` over duplicated operational mirrors such as `AGENTS.md` and `CLAUDE.md`.
`status` now includes a `changeAwareness` block for lightweight file-level changes since the last index and, when available, since current `git HEAD`.
`status` also includes an `embeddings` block so you can tell whether hybrid retrieval is configured, available for the active model, and backed by indexed vectors.
`watch` is the low-overhead automatic refresh loop for repo-local indexing. Start with `watch --once` for an explicit freshness sweep, then use a polling interval if you want foreground auto-refresh while you work.
`lookup` is the convenience helper for the common `query -> best hit -> show` workflow, returning the selected result, its full context, and a short alternative list in one payload.
When embeddings are enabled and indexed, `query` and `lookup` now report `retrieval.mode = "hybrid"` and blend lexical plus semantic candidates automatically. Hybrid mode is now strong enough to visibly influence weak conceptual queries instead of staying purely diagnostic. The output also exposes a `retrieval.hybrid` block so you can see how many semantic candidates were retrieved, how many survived into the final result set, and whether the top result carried a semantic signal. Individual results include `retrievalChannels` and `hybridContribution` so semantic assistance is visible even when lexical matching still dominates the final explanation.

## Optional Embeddings

Embeddings are opt-in and local-first. If they are disabled, missing, or stale for the active model, symballist stays on the lexical path.

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

Current first-slice behavior:

- provider support starts with Ollama
- embeddings are generated during `index`
- changed files naturally refresh their vectors on reindex
- `query` and `lookup` use hybrid retrieval automatically when vectors are available for the active provider/model
- if Ollama is unavailable or the configured model has not been indexed yet, results fall back to lexical retrieval without failing closed

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

## Near-Term Direction

The long-term direction is graph-aware retrieval for agents, with hybrid lexical and semantic ranking as the default path when available. V1 keeps that architecture in view, but ships the smallest useful vertical slice first.
