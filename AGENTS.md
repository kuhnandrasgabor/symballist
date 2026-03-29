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

Use `symballist` as a CLI-first read-only retrieval helper for this repo.

- Preferred local entrypoint:
  - `.symballist\bin\symballist.cmd`
- If `symballist` is installed globally or linked, that command name is also acceptable.
- Check freshness first:
  - `.symballist\bin\symballist.cmd status --root D:\Projects\symballist`
- Use the `changeAwareness` block from `status` when you want a cheap answer to what changed since the last index or, in git repos, since `HEAD`.
- Use the `embeddings` block from `status` when you want to know whether hybrid retrieval is configured and available for the active model.
- If the index is stale, refresh it before relying on results:
  - `.symballist\bin\symballist.cmd index --root D:\Projects\symballist`
- If you want a one-shot freshness sweep that automatically reuses incremental indexing:
  - `.symballist\bin\symballist.cmd watch --once --root D:\Projects\symballist`
- Use lookup for the common `query -> top hit -> show` flow:
  - `.symballist\bin\symballist.cmd lookup "<text>" --root D:\Projects\symballist`
- If embeddings are enabled, inspect the `retrieval` block from `query` or `lookup` to see whether the run was truly `hybrid` or fell back to lexical.
- Use query for discovery:
  - `.symballist\bin\symballist.cmd query "<text>" --root D:\Projects\symballist`
  - Add `--code-only --exclude-tests` for implementation-heavy results.
  - Add `--prefer-implementation` when broad code queries still lean toward wiring or references.
  - Add `--docs-only` when you are explicitly looking for workflows, plans, or architecture notes.
- Use show for full context and related symbols:
  - `.symballist\bin\symballist.cmd show <id> --root D:\Projects\symballist`
  - `.symballist\bin\symballist.cmd show --name <symbol> --root D:\Projects\symballist`
  - `.symballist\bin\symballist.cmd show --name <symbol> --full --root D:\Projects\symballist`
- Only run `.symballist\bin\symballist.cmd watch --interval-ms 2000 --root D:\Projects\symballist` when you explicitly want a foreground polling loop while you work.
- Optional embeddings currently start with Ollama and are configured in `.symballist\config.json`.
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
<!-- SYMBALLIST RETRIEVAL END -->
