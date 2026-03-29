---
id: DRAFT-010
title: Ensure init adds .symballist to .gitignore by default
status: Draft
assignee: []
created_date: '2026-03-28 17:34'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Problem: downstream repos can accidentally commit generated .symballist state after running symballist init. Desired behavior: symballist init should ensure the repo root .gitignore contains a .symballist/ entry by default. Scope: if .gitignore exists and the entry is missing, append it idempotently; if .gitignore does not exist, create it with the .symballist/ entry. Safety rule: do not automatically untrack already tracked files or run git commands on the user’s behalf. UX note: if .symballist appears to be tracked already, init should print a short follow-up hint telling the user they may need to run git rm --cached -r .symballist manually. Acceptance criteria: rerunning init does not duplicate the ignore line, fresh repos get a .gitignore with .symballist/, existing repos get the line appended once, and tracked-file cleanup remains an explicit manual step.
<!-- SECTION:DESCRIPTION:END -->
