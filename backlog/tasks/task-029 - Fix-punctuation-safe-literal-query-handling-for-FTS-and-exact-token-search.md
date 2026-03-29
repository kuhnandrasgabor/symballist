---
id: TASK-029
title: Fix punctuation-safe literal query handling for FTS and exact-token search
status: Done
assignee: []
created_date: '2026-03-29 15:42'
updated_date: '2026-03-29 15:58'
labels:
  - idea
  - spike
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback summary
- Agent testing found that punctuation-heavy literal queries like SYMBALLIST-OMEGA-ALPHA-7291 still break parsing with SQL/FTS errors instead of behaving like safe literal searches.
- This is now one of the clearest correctness gaps in the CLI retrieval loop.

Why it matters
- Exact-token and probe-style queries are common when validating fresh indexing, debugging retrieval, or searching for generated sentinels.
- A query parser failure breaks trust more than a mediocre ranking result.

Suggested direction
- Ensure query text is safely escaped or normalized before reaching FTS.
- Preserve the ability to search literal punctuation-heavy strings without requiring users to rephrase them manually.
- Clarify when the system is tokenizing for FTS versus attempting an exact/literal fallback path.

Expected outcome
- Punctuation-heavy searches no longer throw parse errors and return either meaningful literal hits or an empty result set cleanly.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented punctuation-safe query handling by switching FTS query construction to safe alphanumeric/underscore token extraction and adding a literal-search fallback when FTS returns nothing or rejects the query. This fixes hyphenated probe strings like SYMBALLIST-OMEGA-ALPHA-7291 without regressing broader ranking behavior. Verification: bun test (36 pass) plus a live hyphenated query against co-ma now returns clean JSON output instead of an FTS parse error.
<!-- SECTION:FINAL_SUMMARY:END -->
