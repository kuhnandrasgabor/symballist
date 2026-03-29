# Idea Intake Workflow

Use this workflow when a user wants to capture, vet, compare, discuss, or promote an idea inside backlog without relying on chat history as the durable source of truth.

This is a backlog intake workflow, not an implementation workflow. Its job is to classify, route, and record work in backlog, then stop unless the user explicitly asks to switch from intake into execution as a separate step.

## Purpose

The goal is to treat backlog as both:

- the commitment tracker for approved work
- the durable discussion surface for exploratory work

In this project, exploratory work lives in `Draft` backlog tasks. Approved work moves into `Todo`.

## When To Use It

Use this workflow when the user asks to:

- capture an idea
- sanity-check an idea against the current pipeline
- see whether a request already exists
- flesh out a feature before implementation
- discuss whether an idea should be merged, split, promoted, or dropped

Do not use this workflow for trivial mechanical edits that do not need planning or tracking.
If the user explicitly invokes this workflow or the local `idea` skill for a bug report or feature request, treat that as a request to track and triage it first, not to fix it in the same pass.

## Storage Model

- Keep raw ideas inside backlog. Do not create a separate notes folder.
- Use `Draft` tasks as the exploration layer.
- Use `Todo` and `In Progress` tasks as the active pipeline.
- Use `plan.md` and `ROADMAP.md` only as strategic context, not the source of truth for current work.

## Discovery First

Before creating or updating anything:

1. Search for related backlog tasks and drafts using focused keywords.
2. Inspect related `Draft`, `Todo`, and `In Progress` items.
3. Check whether the idea overlaps with roadmap direction, milestone direction, or active implementation.
4. Prefer updating an existing draft or task over creating a near-duplicate.

Keep discovery lightweight by default. Read only enough backlog and code context to answer overlap, conflict, and readiness questions. Avoid deep code archaeology or implementation design during intake unless the user explicitly asks for research, promotion, or immediate execution.

Read enough context to answer:

- Is this already covered?
- Is this mostly covered but missing an edge, constraint, or acceptance criterion?
- Does this conflict with active direction or sequencing?
- Is this genuinely new?

## Allowed Outcomes

Treat each of these as a successful result:

### `no-op`

Use when the idea is already represented well enough by existing work.

Result:

- make no backlog changes
- return the overlapping items
- explain why nothing changed

### `light-touch update`

Use when the idea mostly exists already but needs a small refinement.

Result:

- update an existing draft or task
- keep the change narrow
- record the new nuance, edge case, dependency, or acceptance criterion

### `discussion required`

Use when overlap is high but the right action is not obvious, or when the idea conflicts with current direction.

Result:

- stop after discovery
- summarize overlap, risks, and conflicts
- offer a short list of concrete next actions

Do not create a new draft just to avoid asking for judgment.

### `new draft`

Use when the idea is meaningful and backlog-worthy, but is still exploratory.

Result:

- create a `Draft` task
- label it with `idea`
- add `spike` or `decision` only when those labels materially improve routing
- keep the draft lightweight by default unless the user explicitly wants deeper spike or decision work

### `promote`

Use when the idea is clear enough to become tracked work now.

Result:

- create a new non-draft task, or
- promote/update an existing draft into `Todo`

Promotion should include clearer acceptance criteria and dependencies than an exploratory draft needs.
Promotion should also confirm that the task context is still fresh enough to execute now rather than simply inheriting old assumptions from earlier discussion.

## Stop Point

End this workflow after one or more of the allowed outcomes above are complete.

That means the normal finish line is:

- backlog unchanged with an explanation, or
- a narrow backlog update, or
- a new or promoted backlog item, plus a short recommendation

Do not continue from intake straight into code changes, implementation-focused debugging, or execution planning in the same pass just because the likely fix seems obvious. If execution is desired, pause after intake, summarize the tracking result, and only continue when the user explicitly asks to switch into execution.

## Draft Structure

When creating or refreshing a draft, keep it concise and durable.

### Title

Use an outcome-oriented exploratory title, for example:

- `Explore project-scoped memory snapshots`
- `Evaluate recall conflict resolution heuristics`
- `Decide how to expose tool lineage in session inspection`

### Labels

- always include `idea`
- add `spike` for research-heavy exploration
- add `decision` for directional or architectural choices

### Description

Capture:

- the idea in one short paragraph
- why it matters
- the user or system value

### Notes

Use notes as the durable discussion surface. Keep a compact structure:

```text
Intake summary
- Short restatement of the request

Related backlog items
- TASK-000 ... why it overlaps

Potential conflicts
- Active work, sequencing, architecture, or roadmap concerns

Open questions
- Questions that block promotion or implementation

Recommended next action
- No-op, update existing task, continue discussion, create draft, or promote
```

Keep notes focused on the problem, overlap, risks, and open questions. Avoid baking in code-shape assumptions or concrete implementation steps that may go stale before execution.

### Plan

Only include a plan on a draft when there is explicit follow-up research or decision work. Keep it focused on exploration, not implementation. For simple bugs or ideas, it is better to leave the plan minimal than to produce an implementation blueprint too early.

### Acceptance Criteria

Use only when the desired outcome is already concrete enough to test or review. For early exploration, it is fine to leave acceptance criteria minimal.

## Discussion Mode

When the correct action is unclear, use the draft or overlapping task as the anchor for discussion.

- summarize what already exists
- explain why the overlap is not just duplication
- offer 2 or 3 concrete options
- wait for direction before expanding scope

The discussion should refine backlog state, not replace it.

## Promotion Rules

Promote a draft only when:

- the intended outcome is clear
- overlap with existing work is understood
- conflicts and dependencies are acceptable or recorded
- the task is concrete enough for another agent to act without chat history
- any code-level observations, assumptions, or sequencing notes that may have aged have been revalidated or refreshed

When promoting:

- update title and description if needed
- add or refine acceptance criteria
- add dependencies and references
- refresh stale notes or plans instead of carrying forward outdated implementation detail
- move status to `Todo`

## Guardrails

- Do not silently create duplicates.
- Do not silently expand existing task scope in a risky way.
- Do not treat intake as permission to inspect code deeply enough to design or ship the fix.
- Do not implement from a `Draft` unless the user explicitly asks for exploration work or promotion.
- Do not create a task and then immediately implement it in the same pass unless the user explicitly asks for that mode switch after seeing the intake result.
- Do not produce detailed implementation plans from intake alone unless the user explicitly asks for that depth.
- If you record code-level observations during intake, treat (and mark) them as provisional and expect them to be revalidated at execution time.
- Prefer the smallest correct backlog change.
- If discovery shows the idea is already covered, saying "nothing changed" is a good outcome.
