---
name: backlog
description: Manage the project backlog using the Backlog.md CLI. Use when the user wants to create, view, update, search, list, or complete tasks; check task status; update implementation notes or acceptance criteria; move tasks between statuses; or do any other backlog management. Also use when AGENTS.md backlog workflow instructions apply and no other method is available.
disable-model-invocation: true
---

# Backlog CLI Skill

This project uses the `backlog` CLI for all task management. The MCP connector may not be available; use CLI commands via the Bash tool instead.

## Current State
- Tasks: !`backlog task list --plain`

## Key Rules

1. **Search before creating** - run `backlog search "<keywords>" --plain` first to avoid duplicates.
2. **Never start substantial work without a task** - trivial/mechanical changes are exempt.
3. **Status flow**: `Draft` -> `Todo` -> `In Progress` -> `Blocked`/`Done` -> `Archived`
4. **Update task before closing** - add implementation notes and final summary before marking `Done`.

## Common Commands (always use `--plain` for scripting/AI)

### View and search
```bash
backlog task list --plain                          # all tasks
backlog task list -s "In Progress" --plain         # filter by status
backlog task 6 --plain                             # view task detail
backlog search "keyword" --plain                   # fuzzy search
backlog doc list --plain                           # list docs
backlog doc view doc-5 --plain                     # view a doc
```

### Create tasks
```bash
# Minimal
backlog task create "Title" -l feature -s "Todo"

# Full
backlog task create "Title" \
  -d "Description" \
  -l feature \
  -s "Todo" \
  --priority high \
  --ac "Criterion 1" --ac "Criterion 2" \
  --plan $'1. Step one\n2. Step two' \
  --ref src/relevant/file.py \
  --doc backlog/docs/relevant-doc.md
```

### Update tasks
```bash
# Change status
backlog task edit 6 -s "In Progress"
backlog task edit 6 -s "Done"

# Add/check acceptance criteria
backlog task edit 6 --ac "New criterion"
backlog task edit 6 --check-ac 1
backlog task edit 6 --check-ac 2

# Update implementation notes (--append-notes adds to existing)
backlog task edit 6 --append-notes $'Completed X. Found Y issue.\nNext: Z'

# Add final summary before closing
backlog task edit 6 --final-summary $'Changed files: ...\nVerified: tests pass'

# Add implementation plan
backlog task edit 6 --plan $'1. Research\n2. Implement\n3. Test'

# Add dependencies / references
backlog task edit 6 --dep task-1
backlog task edit 6 --ref src/coma/relevant.py
```

### Definition of Done checks
```bash
backlog task edit 6 --check-dod 1    # mark DoD item done
backlog task edit 6 --check-dod 2
backlog task edit 6 --check-dod 3
```

### Complete and archive
```bash
backlog task edit 6 -s "Done"
backlog task archive 6
```

## Task Lifecycle Workflow

### Starting a task
1. `backlog task list --plain` - find the right task
2. `backlog task <id> --plain` - read full detail
3. `backlog task edit <id> -s "In Progress"` - claim it
4. If no plan exists: `backlog task edit <id> --plan $'1. ...\n2. ...'`

### During implementation
- Append notes as work progresses: `backlog task edit <id> --append-notes "..."`
- Check off AC items as they're met: `backlog task edit <id> --check-ac <n>`

### Finishing a task
1. Check all DoD items: `backlog task edit <id> --check-dod 1 --check-dod 2 --check-dod 3`
2. Add final summary: `backlog task edit <id> --final-summary $'...'`
3. Mark done: `backlog task edit <id> -s "Done"`
4. Capture follow-ups in new tasks before archiving.

## Project Context

**Labels**: `bug`, `feature`, `idea`, `chore`, `spike`, `decision`
**Priorities**: `high`, `medium`, `low`
**Statuses**: `Draft`, `Todo`, `In Progress`, `Blocked`, `Done`, `Archived`
**Milestone**: `m-0` (phase-6 current), `m-1` (phase-7 future)
**Assignee**: `@codex` (AI), `@user` (human) - omit if unassigned

## Multi-line Input (Bash)

Use `$'...\n...'` for newlines in plan/notes/summary on bash:
```bash
backlog task edit 7 --plan $'1. Research existing code\n2. Implement changes\n3. Run tests'
```
