# Initial Plan

This document preserves the original project brief before the README was rewritten into a narrower v1 specification.

---

# symballist - Project Brief

## Goal

Build a **local-first, agent-agnostic code intelligence tool** that indexes a codebase and enables **semantic + structural search** for AI agents (Claude, Codex, etc.) and CLI users.

This tool is designed to:

* Work fully **offline** using local models (via Ollama)
* Be **installable globally** (CLI tool)
* Store all state **locally inside each repo**
* Expose functionality via **MCP (Model Context Protocol)** for agent integration
* Provide better-than-grep search via **symbol-aware indexing + embeddings**

---

## Name

**symballist**

Rationale:

* Derived from "symbolist" -> focused on code symbols
* Unique, low collision
* CLI-friendly

---

## High-Level Architecture

```text
global CLI (symballist)
    ->
runs inside any repo
    ->
creates .symballist/ (local state)
    ->
indexes code -> symbols + embeddings + graph
    ->
serves:
  - CLI queries
  - MCP server (for agents)
  - optional local dashboard
```

---

## Core Features (v1 scope)

### 1. CLI

Commands:

* `symballist init`
* `symballist index`
* `symballist query "<text>"`
* `symballist mcp`
* `symballist status` (optional)

---

### 2. Repo-local storage

Each indexed repo contains:

```text
.symballist/
  config.json
  index.db        (SQLite)
  cache/
  logs/
```

---

### 3. Parsing (code-aware)

Use **tree-sitter** for parsing.

Extract:

* functions / methods
* classes / structs
* imports / exports
* docstrings / comments

Each symbol becomes a record:

```json
{
  "path": "...",
  "name": "...",
  "kind": "...",
  "signature": "...",
  "body": "...",
  "doc": "...",
  "language": "...",
  "relations": [...]
}
```

---

### 4. Embeddings (local)

Use:

* Ollama
* model: nomic-embed-text

Requirements:

* batch requests
* enforce max input size (avoid overflow errors)
* do NOT rely on backend truncation

---

### 5. Storage

Use **SQLite**:

* metadata tables (files, symbols, edges)
* embeddings (stored as blobs or vectors)
* FTS5 for lexical search

---

### 6. Retrieval (hybrid)

Query pipeline:

1. lexical search (FTS)
2. embedding similarity
3. merge rankings
4. expand via graph (imports/calls)

Return:

* relevant symbols
* surrounding context
* related symbols

---

### 7. Graph layer (lightweight)

Store relationships:

* imports
* file containment
* basic call references (if easy)

Use this for:

* expanding search results
* improving agent context

---

### 8. MCP server (agent interface)

Expose tools:

* `semantic_search(query, limit)`
* `get_symbol(id or path)`
* `find_related(symbol_id)`

Server runs via:

```bash
symballist mcp
```

Agents connect via standard MCP config.

---

## Design Principles

* **Local-first** (no cloud dependencies)
* **Provider-agnostic** (works with any LLM via MCP)
* **Repo-scoped state**
* **Symbol-aware (not naive chunking)**
* **Hybrid search (not vector-only)**
* **Simple CLI UX (like backlog.md)**

---

## Development Setup

This project is a **standalone repo**, used alongside CoMa:

```text
workspace/
  co-ma/
  symballist/
```

During development:

* run symballist against `../co-ma`
* use local linking (npm link / pip -e)

---

## Non-Goals (v1)

* No cloud APIs
* No multi-user support
* No heavy UI (optional lightweight dashboard later)
* No complex agent logic inside the tool

---

## Summary

symballist is:

> a lightweight, local code intelligence service that enables agents to understand and search codebases using symbols, embeddings, and structure, exposed via CLI and MCP.

---

## Original Starting Sequence

1. CLI skeleton
2. repo init + config
3. file walker + parser
4. SQLite schema
5. embedding integration
6. basic query pipeline

Keep it minimal and working before expanding.
