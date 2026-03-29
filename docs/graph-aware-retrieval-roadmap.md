# Graph-Aware Retrieval Roadmap

This document turns the broad "graph-RAG later" idea into a staged plan that fits the current shape of `symballist`.

The goal is not to build a full knowledge graph platform. The goal is to improve retrieval in bounded, useful steps that compound the current lexical + semantic pipeline.

## Current Baseline

Today `symballist` already has the first pieces of a graph-aware system:

- symbol-level retrieval
- lightweight `contained_in` and `imports` relations
- `show` and `lookup` expansion through `relations` and `related`
- hybrid lexical + semantic retrieval
- explicit freshness and change-awareness surfaces

That means the project is already beyond plain search, but it is not yet doing graph-aware reranking or context assembly in a first-class way.

## What Problem Graph-Aware Retrieval Should Solve

The next user problem is no longer "can we find a relevant symbol?"

It is:

- "can we find the right symbol neighborhood?"
- "can we attach enough local context to the top hit that an agent can act confidently?"
- "can we rerank ambiguous hits using structure instead of only text similarity?"

That suggests a staged path:

1. rerank with graph evidence
2. expand with bounded graph context
3. assemble graph-shaped agent context packages

## Design Constraints

Keep these constraints explicit:

- no deep recursive traversal by default
- no always-on graph service
- no separate graph database
- no "graph-RAG" branding without actual graph value
- no replacement of the existing lexical + semantic pipeline

Graph awareness should compound retrieval, not replace it.

## Stage 1: Graph-Aware Reranking

### Goal

Improve ambiguous result ordering by using one-hop structural evidence from already indexed relations.

### Inputs

- current candidate set from lexical + semantic retrieval
- `contained_in` relations
- `imports` relations

### Behavior

Add bounded reranking signals such as:

- boost a symbol when several top candidates point to the same container
- boost a symbol whose file imports or contains other high-ranking candidates
- boost files/symbols that form a coherent local neighborhood instead of isolated hits
- use relation agreement as a tiebreaker, not a dominant override

### Expected Lift

- moderate
- especially helpful for ambiguous conceptual queries
- likely the cheapest graph-aware step with visible impact

### Complexity

- low to moderate
- no new storage model required
- mostly scoring and result-shaping work

### Recommendation

This should be the first implementation slice.

## Stage 2: Bounded Graph Expansion

### Goal

Turn a top hit into a better local context package without requiring a second or third manual retrieval step.

### Behavior

Build on `lookup` and `show` with bounded expansion such as:

- container symbol
- imported symbols
- sibling definitions in the same file
- optional "same file neighborhood" around the span

### Constraints

- one hop only by default
- explicit limits on symbol count and body size
- relation types must stay visible in output

### Candidate Surface

- `lookup --expand`
- richer `selectedContext` block in `lookup`
- optional `query --expand-top`

### Expected Lift

- high for agent workflows
- makes discovery results more immediately usable

### Complexity

- moderate
- mostly output shaping and budgeting

### Recommendation

Do this after graph-aware reranking improves hit quality, not before.

## Stage 3: Graph-Backed Context Assembly

### Goal

Assemble a compact agent-ready context package from the retrieval result plus its bounded graph neighborhood.

### Behavior

Produce a structured context envelope such as:

- primary symbol
- why it matched
- directly related symbols
- relation edges
- optional file or doc anchors
- strict token / char budgeting

### Key Difference From Stage 2

Stage 2 expands the result.
Stage 3 intentionally assembles an agent context package.

That means it needs:

- deterministic budgeting
- stable output structure
- explicit ranking of included neighbors

### Expected Lift

- high for agent integration
- especially useful once downstream projects start using `lookup` as a default entrypoint

### Complexity

- moderate to high
- requires good budgeting and output semantics

### Recommendation

Treat this as a product feature after Stage 1 and Stage 2 prove valuable.

## Stage 4: True Graph-RAG Exploration

### Goal

Explore whether deeper multi-hop graph retrieval materially outperforms bounded graph-aware retrieval for real agent tasks.

### Behavior

Possible later experiments:

- multi-hop traversal with hard hop and budget limits
- relation-weighted neighborhood scoring
- query-type-specific graph expansion
- graph-informed answer context assembly across files and docs

### Risks

- recursion noise
- context explosion
- opaque ranking
- large implementation cost with uncertain marginal gain

### Recommendation

Do not start here.
Reach this stage only if earlier graph-aware slices show clear value and clear failure modes that deeper traversal would fix.

## What Not To Build Yet

Avoid these until the staged path proves them necessary:

- a separate graph datastore
- automatic whole-repo traversal on every query
- call graph inference beyond what current indexing already supports
- relation extraction that requires heavy static analysis infrastructure
- a daemon whose only purpose is graph maintenance

## Recommended Next Graph Slice

If we start implementation later, the first graph-aware task should be:

`Add graph-aware reranking using one-hop containment/import agreement inside the existing candidate set`

That slice should:

- stay inside the current SQLite model
- operate only on already retrieved candidates
- add explainable graph signals
- avoid expanding the result payload yet

This is the best balance of:

- visible lift
- low architecture risk
- easy rollback if the scoring feels wrong

## Lift vs Cost Summary

| Stage | Outcome | Expected Lift | Complexity | Recommended Order |
| --- | --- | --- | --- | --- |
| 1 | Graph-aware reranking | Moderate | Low/Moderate | First |
| 2 | Bounded graph expansion | High | Moderate | Second |
| 3 | Graph-backed context assembly | High | Moderate/High | Third |
| 4 | True graph-RAG exploration | Uncertain/Strategic | High | Last |

## Decision

The project should not jump straight to graph-RAG.

The right path is:

1. graph-aware reranking
2. bounded one-hop expansion
3. structured context assembly
4. only then deeper graph-RAG experiments

That keeps the roadmap ambitious without making the next step reckless.
