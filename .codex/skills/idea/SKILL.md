---
name: idea
description: Track, vet, discuss, and route a single project idea or bug report in backlog using Draft tasks as the exploration layer. Use when the user wants to add work, check whether it already exists, compare it against current pipeline work, refine backlog state, or decide whether to merge, update, promote, or drop it. This skill is for intake and tracking only; stop after discovery and backlog updates unless the user explicitly asks to switch into execution.
metadata:
  short-description: Backlog-native idea triage
---

# Idea

Use this skill when the user wants a backlog-native way to capture or discuss ideas without relying on a single chat session.

This skill is explicitly for tracking and triage, not for implementing the work it describes.

## First Step

Read [the shared workflow](../../../docs/agent-workflows/idea-intake.md) before making backlog changes.

## Hard Boundary

Stop after discovery, discussion, and backlog mutation.

Do not patch code, do implementation-focused debugging, or turn intake into same-pass execution just because a likely fix is easy to guess. If the user wants implementation too, finish the intake result first and then switch modes only when they explicitly ask.

## Default Behavior

Follow the shared workflow's outcome model:

- `no-op`
- `light-touch update`
- `discussion required`
- `new draft`
- `promote`

The smallest correct action is preferred. No change is a valid result.
Bias toward lightweight triage over deep research during intake. Read only enough project and code context to classify overlap, fit, and readiness. Do not turn a simple bug report or idea into an implementation-ready plan unless the user explicitly asks for research, promotion, or immediate execution.

## Project Conventions

- Keep idea state inside backlog. Do not create a separate notes folder.
- Use `Draft` tasks for exploratory ideas and durable discussion.
- Use the `idea` label on exploratory drafts.
- Add `spike` or `decision` only when they sharpen routing.
- Check related `Draft`, `Todo`, and `In Progress` items before creating something new.
- Use `plan.md` and `ROADMAP.md` only to understand strategic fit or conflicts.

## Tooling

- When Backlog.md MCP tools are available, use them.
- Follow this repository's backlog workflow instructions in `AGENTS.md`.

## Discussion Trigger

If discovery shows strong overlap or non-obvious tradeoffs, pause after triage and present concrete options instead of forcing a new draft.
