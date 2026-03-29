
<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses the repo-local Backlog.md setup in `D:\Projects\symballist\backlog`.

**CRITICAL GUIDANCE**

- Prefer the local `backlog` CLI for task, draft, milestone, and document operations in this repo.
- Run Backlog commands from the repo root so they operate on this repository's local backlog state.
- Use MCP workflow resources only for generic Backlog workflow guidance, or when you have verified the MCP server is scoped to this repo's backlog.
- Do not assume a shared MCP Backlog server is pointed at this project.

Recommended local commands:

- `backlog overview`
- `backlog task list`
- `backlog draft list`
- `backlog task create ...`
- `backlog draft create ...`
- `backlog task view <id>`
- `backlog draft view <id>`

If your client supports MCP resources and they are verified to be repo-scoped, read `backlog://workflow/overview` to understand when and how to use Backlog workflows.
If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` to load the workflow overview.

- **First time working here?** Read the overview guidance IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview guidance to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
