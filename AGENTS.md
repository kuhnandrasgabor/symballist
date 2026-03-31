<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses the repo-local Backlog.md setup in `backlog/`.

**CRITICAL GUIDANCE**

- Prefer the local `backlog` CLI for task, draft, milestone, and document operations in this repo.
- Run Backlog commands from the repo root so they operate on this repository's local backlog state.
- If you use MCP for Backlog in this repo, the server must be pinned to this repo with `backlog mcp start --cwd <REPO_ROOT>` or an equivalent `BACKLOG_CWD` setting.
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
- `backlog mcp start --cwd <REPO_ROOT>`
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

- `docs/agent-workflows/symballist-adoption.md`

Keep the integration CLI-first, use `status -> index -> query -> show`, and treat `symballist` as a read-only helper rather than the sole source of truth.

<!-- SYMBALLIST RETRIEVAL START -->
## Symballist Retrieval

Use the generated repo-local `symballist` tool definitions when your agent runtime has actually loaded them. Keep the repo-local CLI wrappers as the robust fallback.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

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
- Use the CLI fallback `symballist report` only when `impactTracking.enabled` is true in `.symballist/config.json` and you explicitly want the local aggregate usage and impact summary; it does not store raw query text.
- The JSON manifest existing on disk does not make `symballist_*` callable by itself.
- If `symballist` is installed globally or linked, the plain CLI command is the simplest manual fallback when working from this repo root.
- CLI fallback entrypoints:
  - bash / zsh / sh: `./.symballist/bin/symballist`
  - PowerShell / cmd.exe: `.\.symballist\bin\symballist.cmd`
- Mandatory first step: use `symballist_status` first or run `symballist status` to inspect freshness, index compatibility, graph awareness, and embeddings state.
- If the repo is stale, use `symballist_refresh` or run `symballist watch --once`.
- If `indexCompatibility.requiresRebuild` is true, run `symballist index --rebuild`.
- If auto-watch is already active, `symballist watch --once` may return an already-fresh no-op. That is expected.
- If the tools are not actually available in the runtime, use the repo-local CLI wrapper immediately instead of probing further.
- Prefer `symballist_lookup` when you want one selected best hit with graph diagnostics, context, and alternatives.
- Use `symballist_query` / `symballist_show` when you want more manual ranked exploration or direct symbol inspection with graph diagnostics, or use the equivalent CLI commands if tool loading is unavailable.
- Use the CLI fallback `symballist graph --name <symbol>` when you want grouped graph traversal neighbors such as imports, usedBy, or importedBy.
- Use the CLI fallback `symballist report` only when you explicitly want the opt-in local usage and impact summary for this repo.
- Query styles by goal:
  - exact symbol: `symballist_lookup`
  - fuzzy implementation concept: `symballist_query` with `--code-only --exclude-tests --prefer-implementation`
  - noisy legacy zones: add repeated `--exclude-path <fragment>` flags such as `--exclude-path _deprecated --exclude-path legacy`
  - config path: `symballist_lookup`
  - CSS selector from a real stylesheet: `symballist_lookup`
  - known id or exact symbol inspection: `symballist_show`
- Consumers may rely on `path`, `file.path`, and `location.path` being present and equivalent in compact and non-compact flows.
- If `resultQuality.noStrongMatch` is true on a weak query, treat that as a valid weak-result signal rather than a tool failure.
- In `symballist_query` and `symballist_lookup`, use `score` and `scoreMarginFromTop` only as relative within-result-set ranking hints, not absolute confidence.
- If you are calling symballist from outside this repo root or cannot rely on a linked install, fall back to the repo-local wrappers or pass `--root /Users/andras.gaborkuhn/symballist` explicitly.
- Treat `symballist` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- `.symballist\instructions\symballist-adoption.md`
<!-- SYMBALLIST RETRIEVAL END -->
