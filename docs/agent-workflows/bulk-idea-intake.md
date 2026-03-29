# Bulk Idea Intake Workflow

Use this workflow when a user provides a block of text, a brainstorm dump, meeting notes, or a list of requests that may contain multiple ideas which need to be captured safely inside backlog.

This is a backlog intake workflow, not an implementation workflow. Its job is to consolidate and route requests into the right backlog state, then stop unless the user explicitly asks to switch from intake into execution as a separate step.

## Purpose

The goal is to turn an unstructured batch of ideas into a small set of consolidated candidate ideas, then reuse the single-idea workflow for durable triage.

Use [the single-idea workflow](./idea-intake.md) as the authoritative triage model for each consolidated idea.

## When To Use It

Use this workflow when the user asks to:

- process many ideas from one message
- split a brainstorm into backlog-ready items
- detect overlaps within a batch of ideas
- bulk-triage requests without creating duplicate drafts

Do not use this workflow for a single well-formed idea. Use the single-idea workflow instead.
If the batch contains bug reports or concrete feature asks, still treat them as tracking and triage inputs first rather than permission to start fixing code in the same pass.

## Coordinator Model

This workflow is coordinator-first.

- The coordinator extracts and normalizes ideas.
- The coordinator merges obvious duplicates and overlaps inside the batch.
- The coordinator decides which consolidated ideas are distinct enough for independent triage.
- Actual backlog mutation should be serialized after consolidation.

Parallel discovery is allowed only after batch-level deduplication and clustering.

## Workflow

### 1. Extract candidate ideas

Read the user input and split it into candidate ideas.

Ignore:

- rhetorical setup
- implementation chatter that does not express a distinct outcome
- repeated phrasing of the same underlying request

Prefer concise candidate idea statements.

### 2. Normalize the candidate ideas

For each candidate idea:

- rewrite it as a short outcome-oriented statement
- remove duplicates caused by wording differences
- collapse very small variants into one stronger parent idea when they clearly belong together

### 3. Cluster overlaps inside the batch

Before looking at backlog, compare the candidate ideas against each other.

Create a single consolidated cluster when ideas:

- target the same user outcome
- affect the same subsystem in nearly the same way
- differ only by examples, edge cases, or phrasing

Keep ideas separate when:

- they can become independent drafts or tasks
- they would likely need separate acceptance criteria
- combining them would make discussion or implementation less clear

### 4. Triage each consolidated idea using the single-idea workflow

For each consolidated idea, apply [the single-idea workflow](./idea-intake.md).

Allowed outcomes for each consolidated idea are still:

- `no-op`
- `light-touch update`
- `discussion required`
- `new draft`
- `promote`

Do not reinvent per-idea triage logic here. Reuse the single-idea model.

### 5. Serialize backlog mutation

If more than one consolidated idea remains after clustering:

- do not let multiple agents update overlapping backlog areas at the same time
- apply backlog changes in a controlled sequence
- if two consolidated ideas point at the same existing task area, resolve that collision before writing

### 6. Report the batch result

Return:

- the consolidated ideas
- which ideas were merged together
- which backlog items were touched
- which items were no-op results
- which items need discussion

Stop after reporting and backlog mutation. Do not continue from batch intake into implementation, code patching, or execution planning unless the user explicitly asks to switch modes after the intake result.

## When To Use Subagents

Subagents are optional.

Use them only when:

- the consolidated ideas are clearly distinct after clustering
- the next step is discovery rather than mutation

Preferred pattern:

1. coordinator extracts and clusters
2. subagents perform discovery on distinct consolidated ideas
3. coordinator applies final backlog writes serially

If overlap is high, keep the work in one agent.

## Guardrails

- Never run raw one-agent-per-bullet mutation on an unprocessed brainstorm.
- Always deduplicate inside the batch before triaging against backlog.
- Reuse the single-idea workflow instead of copying its rules into ad hoc logic.
- Prefer fewer, stronger drafts over many near-duplicates.
- If the batch mostly maps to existing work, a mostly `no-op` result is a valid success.
- Do not convert bulk intake into a same-pass implementation sweep, even when one item looks easy to fix.
