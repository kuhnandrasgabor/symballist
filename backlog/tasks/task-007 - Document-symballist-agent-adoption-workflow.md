---
id: TASK-007
title: Document symballist agent adoption workflow
status: Done
assignee: []
created_date: '2026-03-28 16:11'
updated_date: '2026-03-28 16:12'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a small shared workflow document that explains how another project should use symballist as a CLI-first retrieval helper for Codex and Claude agents, and link to it from this repo's agent instruction files and README.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A shared workflow doc explains when and how to use symballist in another repo.
- [x] #2 The doc includes simple copy-paste snippets for both AGENTS.md and CLAUDE.md in downstream projects.
- [x] #3 This repo's AGENTS.md, CLAUDE.md, or README link to the shared workflow doc so there is one canonical reference.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a shared agent workflow document for downstream symballist adoption covering purpose, CLI-first usage, freshness checks, fallback rules, and the basic status/index/query/show loop.

Included copy-paste snippets for downstream AGENTS.md and CLAUDE.md files, then linked the shared document from this repo's AGENTS.md, CLAUDE.md, and README.md so there is one canonical reference.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented how other projects can adopt symballist as a CLI-first retrieval helper for Codex and Claude agents. Validation for this slice was a direct content and diff review rather than code changes or test behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
