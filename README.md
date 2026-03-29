# symballist

symballist is a local-first code retrieval tool for AI agents. It indexes a repository into symbols, search metadata, and lightweight relationships so agents can search codebases faster and with more structure than plain text search alone.

## V1

V1 is intentionally narrow:

- agent-first retrieval
- CLI-first workflow
- Python and HTML only
- repo-local state in `.symballist/`
- symbol-first indexing with file-level fallback
- SQLite + FTS lexical search
- optional Ollama embeddings for hybrid retrieval later
- incremental reindexing for changed files
- rich query results with symbol spans and snippets

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
- `symballist index`
- `symballist status`
- `symballist query "<text>" --kind class,function`
- `symballist show <id>`

## Local State

```text
.symballist/
  config.json
  index.db
  cache/
  logs/
```

## Near-Term Direction

The long-term direction is graph-aware retrieval for agents, with hybrid lexical and semantic ranking as the default path when available. V1 keeps that architecture in view, but ships the smallest useful vertical slice first.
