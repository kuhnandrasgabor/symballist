---
id: TASK-022
title: Strengthen or clarify prefer-implementation intent behavior
status: Done
assignee: []
created_date: '2026-03-28 22:21'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent downstream feedback says the --prefer-implementation intent flag is visible in the query payload but can have little or no apparent effect on result ordering in real repos. Capture a follow-up to either increase the reranking weight so the flag materially changes broad code queries, or redefine the intent so its behavior is easier to understand, for example by pairing it more strongly with code-oriented filtering. User value: makes intent controls trustworthy, prevents the user from toggling a flag that looks inert, and improves day-to-day control over implementation-heavy retrieval. Observed motivation: one downstream agent explicitly reported that --prefer-implementation showed up in the output intent block without visibly changing ranking, even when docs still appeared above code in an unfiltered query.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `--prefer-implementation` is now treated as a real code-focused intent for non-doc queries instead of only a mild score nudge.
- When active outside `--docs-only`, it suppresses Markdown/doc rows and increases the `src/` boost plus test/doc penalties so the ranking change is visible in practice.
- Added regression coverage showing that unfiltered broad code queries can still include Markdown by default, while the same query with `--prefer-implementation` becomes implementation-heavy and doc-free.

Verification
- `bun test` passes with 25 tests.
- Live `co-ma` check for `query "gateway config api live reload" --top 5 --prefer-implementation` now removes the previous Markdown tail and returns only code results.
- Live `co-ma` check for `query "recall scoring" --top 5 --prefer-implementation` now returns `recall_scoring.py` implementation symbols first with strong `path_concept` reasoning.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
`--prefer-implementation` now behaves like a meaningful code-oriented retrieval intent. It visibly changes ranking, suppresses doc noise for non-doc queries, and makes broad implementation discovery queries more controllable in real repos.
<!-- SECTION:SUMMARY:END -->
