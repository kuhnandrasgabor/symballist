---
id: DRAFT-010
title: >-
  Prefer canonical docs and suppress duplicate operational docs in docs-only
  retrieval
status: Draft
assignee: []
created_date: '2026-03-28 22:21'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent downstream feedback says --docs-only works, but rankings can still be noisy because duplicated operational docs such as AGENTS.md and CLAUDE.md can outrank the canonical project documentation the user likely wants first. Capture a follow-up to prefer canonical docs like README.md, plan.md, and curated docs/ sources while suppressing duplicates and repo-internal operational mirrors when the query intent is documentation-focused. User value: makes docs-only retrieval feel deliberate and less repetitive, especially for onboarding and architecture lookup. Observed motivation: downstream testing reported memory management and related docs queries surfacing duplicated operational docs above the more canonical project docs that would be more useful first.
<!-- SECTION:DESCRIPTION:END -->
