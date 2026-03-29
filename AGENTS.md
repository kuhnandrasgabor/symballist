<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses the repo-local Backlog.md setup in `D:\Projects\symballist\backlog`.

**CRITICAL GUIDANCE**

- Prefer the local `backlog` CLI for task, draft, milestone, and document operations in this repo.
- Run Backlog commands from the repo root so they operate on this repository's local backlog state.
- If you use MCP for Backlog in this repo, the server must be pinned to this repo with `backlog mcp start --cwd D:\Projects\symballist` or an equivalent `BACKLOG_CWD` setting.
- Do not rely on a shared auto-detect Backlog MCP server when multiple projects are active.
- Use MCP workflow resources only for generic Backlog workflow guidance, or when you have verified the MCP server is scoped to this repo's backlog.
- Treat CLI writes as the source of truth unless repo-scoped MCP is explicitly confirmed.

Recommended local commands:

- `backlog overview`
- `backlog task list`
- `backlog draft list`
- `backlog task create ...`
- `backlog draft create ...`
- `backlog task view <id>`
- `backlog draft view <id>`
- `backlog mcp start --cwd D:\Projects\symballist`
- `backlog browser --port 6422 --no-open`

Multi-project safety rules:

- Use a distinct MCP server entry per repo, for example `backlog-symballist` and `backlog-co-ma`.
- Use a unique browser port per repo.
- Keep debug logging off unless you are actively diagnosing a Backlog issue.
- If multiple Backlog services are running, keep any redirected logs in repo-local files so outputs do not get mixed.

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

## Symballist Retrieval

When another local repo wants to use `symballist` as a retrieval helper, follow the shared adoption workflow:

- [docs/agent-workflows/symballist-adoption.md](/D:/Projects/symballist/docs/agent-workflows/symballist-adoption.md)

Keep the integration CLI-first, use `status -> index -> query -> show`, and treat `symballist` as a read-only helper rather than the sole source of truth.

<!-- SYMBALLIST RETRIEVAL START -->
## Symballist Retrieval

Use the generated repo-local `symballist` tool definitions when your agent runtime can load them. Keep the repo-local CLI wrappers as the robust fallback.

- Preferred tool-definition manifest:
  - `.symballist\tools\symballist-tools.json`
- Tooling guide:
  - `.symballist\tools\README.md`
- Preferred tools:
  - `symballist_status`
  - `symballist_refresh`
  - `symballist_lookup`
  - `symballist_query`
  - `symballist_show`
- CLI fallback entrypoints:
  - PowerShell / cmd.exe: `.\.symballist\bin\symballist.cmd`
  - bash / zsh / sh: `./.symballist/bin/symballist`
- Use `symballist_status` first or run `.symballist\bin\symballist.cmd status --root D:\Projects\symballist`.
- If the repo is stale, use `symballist_refresh` or run `.symballist\bin\symballist.cmd watch --once --root D:\Projects\symballist`.
- Prefer `symballist_lookup` for the common `query -> top hit -> show` flow.
- Use `symballist_query` / `symballist_show` when you want more manual control, or use the equivalent CLI commands if tool loading is unavailable.
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
<!-- SYMBALLIST RETRIEVAL END -->
