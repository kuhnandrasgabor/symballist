---
id: TASK-021
title: Ensure init adds .symballist to .gitignore by default
status: Done
assignee: []
created_date: '2026-03-28 17:34'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Problem: downstream repos can accidentally commit generated .symballist state after running symballist init. Desired behavior: symballist init should ensure the repo root .gitignore contains a .symballist/ entry by default. Scope: if .gitignore exists and the entry is missing, append it idempotently; if .gitignore does not exist, create it with the .symballist/ entry. Safety rule: do not automatically untrack already tracked files or run git commands on the user’s behalf. UX note: if .symballist appears to be tracked already, init should print a short follow-up hint telling the user they may need to run git rm --cached -r .symballist manually. Acceptance criteria: rerunning init does not duplicate the ignore line, fresh repos get a .gitignore with .symballist/, existing repos get the line appended once, and tracked-file cleanup remains an explicit manual step.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `symballist init` now ensures the repo-root `.gitignore` contains `.symballist/`.
- If `.gitignore` does not exist, init creates it with that entry.
- If `.gitignore` already exists, init appends the entry once and stays idempotent on repeated runs.
- If `.symballist` appears to already be tracked in Git when the ignore rule is newly added, init prints a manual cleanup hint for `git rm --cached -r .symballist`.

Verification
- `bun test` passes with 24 tests.
- Regression coverage now includes creating `.gitignore`, appending without duplication, and the tracked-file cleanup hint path.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
`symballist init` now protects downstream repos from accidentally committing local Symballist state by default. It manages the `.symballist/` ignore rule idempotently and gives a clear manual cleanup hint when Git is already tracking that directory.
<!-- SECTION:SUMMARY:END -->
