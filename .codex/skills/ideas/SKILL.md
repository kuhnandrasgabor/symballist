---
name: ideas
description: Parse, consolidate, and triage multiple project ideas or bug reports from one block of text using backlog as the durable store. Use when the user provides many requests at once, wants batch deduplication, or needs overlap-safe bulk intake before per-idea triage. This skill is for intake and tracking only; stop after consolidation and backlog updates unless the user explicitly asks to switch into execution.
metadata:
  short-description: Bulk backlog-native idea triage
---

# Ideas

Use this skill when the user wants to process multiple ideas from a single message without creating conflicting or duplicate backlog updates.

This skill is explicitly for tracking and triage, not for implementing the work it uncovers.

## First Step

Read [the shared bulk workflow](../../../docs/agent-workflows/bulk-idea-intake.md) before making backlog changes.

## Hard Boundary

Stop after consolidation, per-idea triage, and serialized backlog mutation.

Do not turn a brainstorm, bug list, or batch intake into a code-change pass. If the user wants implementation after intake, finish the tracking result first and only continue when they explicitly ask to switch modes.

## Reuse Rule

The bulk workflow must reuse [the single-idea workflow](../../../docs/agent-workflows/idea-intake.md) for each consolidated idea instead of duplicating per-idea triage logic.

## Default Behavior

- extract candidate ideas
- normalize and deduplicate within the batch
- cluster overlaps before touching backlog
- apply single-idea triage to each consolidated idea
- serialize final backlog writes

## Tooling

- When Backlog.md MCP tools are available, use them.
- Follow this repository's backlog workflow instructions in `AGENTS.md`.

## Discussion Trigger

If several ideas collide with the same backlog area or strategic direction, stop after consolidation and present concrete options instead of forcing backlog churn.
