---
id: DRAFT-009
title: Explore repo-local usage and impact tracking for Symballist adoption
status: Draft
assignee: []
created_date: '2026-03-29 07:00'
labels:
  - idea
  - decision
  - spike
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore a local-first way to measure whether Symballist materially improves agent workflow quality and cost in adopted repos. The scope should go beyond raw command telemetry to include workflow patterns, retrieval quality outcomes, fallback behavior, and conservative estimated savings, while staying opt-in, inspectable, and repo-local by default.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

Intake summary
- Expand the original tool-usage idea into a broader impact-measurement draft: not just which Symballist commands ran, but whether Symballist actually changed agent behavior, reduced navigation churn, improved one-shot resolution, and strengthened the product story in real repos.
- The draft should help answer two linked questions: what narrow local signals are worth collecting, and what honest impact outputs can Symballist show without pretending to measure more than it really knows.
- Keep the feature local, inspectable, and opt-in rather than hidden telemetry.

Related backlog items
- TASK-001 Track initial symballist vertical slice (umbrella) overlaps because impact measurement is a follow-up product-learning track, not a blocker for the current retrieval slice.
- TASK-026 Decide when and how to add an agent-facing symballist query helper overlaps historically because simpler retrieval flows change what usage patterns look like, but that task solved the helper surface rather than impact measurement.
- TASK-037 Add compact output mode for agent-facing symballist responses overlaps because payload size is one of the concrete impact dimensions this draft may want to measure.
- TASK-051 Add explicit result quality and no-strong-match signaling overlaps because strong/moderate/weak outcomes are likely part of any meaningful local impact summary.
- TASK-056 Add symbol-level change awareness since last index overlaps at the level of local operational awareness, but not at the level of workflow impact.

Potential conflicts
- It is easy for this draft to become vague telemetry infrastructure rather than a Symballist-specific product-learning slice. Keep the focus on Symballist command flows and their immediate retrieval outcomes.
- Privacy and trust matter. Default collection should avoid raw query text unless explicitly enabled; hashes, lengths, classes, or coarse query-shape buckets may be enough.
- Estimated token savings can become marketing fiction if the baseline model is weak. Any savings story should stay conservative, labeled as estimated, and preferably shown as ranges or directional indicators.
- Repo-local storage is attractive for trust, but long-lived append-only event logs may become noisy or hard to inspect if the shape is too granular.

Expanded scope worth exploring
- Symballist command usage: `status`, `index`, `watch`, `lookup`, `query`, `show`, `graph`, compact/full usage, lexical versus hybrid mode, stale versus fresh repo state.
- Workflow-shape signals: lookup-only success, query-to-show chains, lookup-to-show expansion, graph follow-up after lookup, repeated retries after weak results, fallbacks after `noStrongMatch`.
- Quality and resolution signals: `resultQuality` levels, `noStrongMatch` rates, number of commands needed before a direct inspection happened, truncation versus full-body expansion, graph traversal usage after retrieval.
- Adoption and operational signals: whether users rely on linked CLI versus wrapper paths, whether repos keep auto-watch active, whether index rebuilds are common after upgrades, whether embeddings are enabled.
- Evidence surfaces beyond telemetry: downstream user feedback snippets, manually logged case studies, and repo-local summaries of notable wins or misses could complement raw counters.

Candidate metrics and derived views
- command-family counts and per-session command sequences
- average number of Symballist commands before a successful direct inspection or graph traversal
- proportion of interactions resolved via lookup alone versus lookup-plus-show versus query exploration
- frequency of strong/moderate/weak `resultQuality` outcomes by command family
- approximate payload returned by Symballist, including compact versus non-compact and summary versus full-body flows
- conservative estimated navigation avoided, for example replacing repeated grep plus file-read loops with one lookup or one lookup-plus-show flow
- quality-adjusted success indicators, such as one-shot strong lookup rate or repeated-weak-query rate
- graph-usage indicators, such as when graph traversal reduces extra query cycles after initial retrieval

Open questions
- What is the smallest useful local record: append-only events, rolling counters, per-session summaries, or a derived metrics snapshot?
- Which impact dimensions matter most for the product right now: token savings, tool-call savings, one-shot resolution, trust calibration, adoption friction, or downstream retention?
- Should feedback and case-study notes live beside the local metrics, or should this draft remain strictly machine-collected?
- What baseline navigation model is honest enough to estimate avoided cost without overstating the value proposition?
- Should query text be omitted entirely, represented as shape buckets, or made explicitly opt-in?
- Where should the result surface appear: `status`, a dedicated `metrics` or `report` command, or repo-local files under `.symballist/`?

Recommended next action
- Keep this as a draft, but shift its purpose from narrow usage telemetry to a small, opt-in Symballist impact-evaluation slice. Bias toward a first phase that measures workflow outcomes and retrieval quality with conservative local estimates, then decide later whether deeper event logging is actually necessary.

## Acceptance Criteria

- [ ] The draft identifies a smallest credible opt-in measurement slice for Symballist impact, not just generic telemetry.
- [ ] The draft defines which local signals are product-relevant enough to measure workflow quality, trust, and conservative savings.
- [ ] The draft explicitly records privacy boundaries and avoids assuming raw query text collection by default.
