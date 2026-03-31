import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_DIR, CACHE_DIR, CONFIG_FILE, LOGS_DIR, SUPPORTED_EXTENSIONS, SUPPORTED_FILENAMES, appPath, defaultConfig } from "./config.ts";
import type { SymballistConfig } from "./config.ts";
import type { SetupType } from "./config.ts";

const SKIP_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".venv",
  ".pytest_cache",
  ".pytest-basetemp",
  ".pytest-runs",
  ".pytest-tmp",
  ".ruff_cache",
  "__pycache__",
  "node_modules",
  APP_DIR,
  "backlog"
]);

const INSTRUCTIONS_DIR = "instructions";
const BIN_DIR = "bin";
const TOOLS_DIR = "tools";
const LOCAL_ADOPTION_GUIDE = "symballist-adoption.md";
const LOCAL_AGENTS_SNIPPET = "AGENTS.symballist.md";
const LOCAL_CLAUDE_SNIPPET = "CLAUDE.symballist.md";
const LOCAL_TOOLS_MANIFEST = "symballist-tools.json";
const LOCAL_TOOLS_README = "README.md";
const LOCAL_WINDOWS_WRAPPER = "symballist.cmd";
const LOCAL_POWERSHELL_WRAPPER = "symballist.ps1";
const LOCAL_POSIX_WRAPPER = "symballist";
const GITIGNORE_FILE = ".gitignore";
const APP_GITIGNORE_ENTRY = ".symballist/";
const MANAGED_BLOCK_START = "<!-- SYMBALLIST RETRIEVAL START -->";
const MANAGED_BLOCK_END = "<!-- SYMBALLIST RETRIEVAL END -->";
const SYMBALLIST_ROOT = normalize(fileURLToPath(new URL("..", import.meta.url))).replace(/[\\\/]+$/, "");
const ADOPTION_GUIDE_SOURCE = fileURLToPath(new URL("../docs/agent-workflows/symballist-adoption.md", import.meta.url));

function isIgnorableFsError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }
  return error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOENT";
}

export async function ensureInitialized(root: string, requestedSetupType?: SetupType): Promise<void> {
  await mkdir(appPath(root), { recursive: true });
  await mkdir(appPath(root, BIN_DIR), { recursive: true });
  await mkdir(appPath(root, CACHE_DIR), { recursive: true });
  await mkdir(appPath(root, LOGS_DIR), { recursive: true });
  await mkdir(appPath(root, INSTRUCTIONS_DIR), { recursive: true });

  const existingConfig = await readConfig(root);
  const setupType = requestedSetupType ?? existingConfig?.setupType ?? defaultConfig(root).setupType;
  await writeConfig(root, mergeConfig(root, existingConfig, setupType));
  await bootstrapAgentInstructions(root, setupType);
  const gitignoreUpdated = await ensureGitignoreEntry(root, APP_GITIGNORE_ENTRY);
  if (gitignoreUpdated && await appearsGitTracked(root, APP_DIR)) {
    console.log("Added .symballist/ to .gitignore. If .symballist is already tracked, run `git rm --cached -r .symballist` once to stop tracking it.");
  }
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isIgnorableFsError(error)) {
      return false;
    }
    throw error;
  }
}

export async function readConfig(root: string): Promise<SymballistConfig | null> {
  const path = appPath(root, CONFIG_FILE);
  if (!(await exists(path))) {
    return null;
  }

  const parsed = JSON.parse(await readText(path)) as Partial<SymballistConfig>;
  return mergeConfig(root, parsed);
}

export async function writeConfig(root: string, config: SymballistConfig): Promise<void> {
  await writeFile(appPath(root, CONFIG_FILE), JSON.stringify(config, null, 2), { flag: "w" });
}

function detectSupportedLanguage(name: string): "python" | "html" | "markdown" | "javascript" | "typescript" | "yaml" | "shell" | "dockerfile" | "css" | null {
  const byName = SUPPORTED_FILENAMES.get(name.toLowerCase());
  if (byName) {
    return byName;
  }

  return SUPPORTED_EXTENSIONS.get(extname(name).toLowerCase()) ?? null;
}

function hasShellShebang(firstLine: string): boolean {
  return /^#!\s*(?:\/usr\/bin\/env\s+(?:-S\s+)?(?:ba|z)?sh\b|\/bin\/(?:ba|z)?sh\b|\/usr\/bin\/(?:ba|z)?sh\b)/.test(firstLine.trim());
}

function looksLikeShellScript(source: string): boolean {
  if (source.includes("\u0000")) {
    return false;
  }

  const lines = source.split(/\r?\n/);
  if (lines.length === 0) {
    return false;
  }

  const firstLine = lines[0]?.trim() ?? "";
  if (hasShellShebang(firstLine)) {
    return true;
  }

  const interestingLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 12);

  if (interestingLines.length === 0) {
    return false;
  }

  let score = 0;
  for (const line of interestingLines) {
    if (line.startsWith("#")) {
      continue;
    }
    if (/^(?:set -[A-Za-z]+|set -o [A-Za-z-]+)$/.test(line)) {
      score += 1;
    }
    if (/^(?:function\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?:\(\))?\s*\{/.test(line)) {
      score += 2;
    }
    if (/^(?:if|then|elif|else|fi|for|do|done|case|esac|while|until|select|in)\b/.test(line)) {
      score += 1;
    }
    if (/^(?:export\s+[A-Za-z_][A-Za-z0-9_]*=|[A-Za-z_][A-Za-z0-9_]*=)/.test(line)) {
      score += 1;
    }
    if (/^(?:exec|source|\.)\s+/.test(line)) {
      score += 1;
    }
    if (line.includes("$(") || line.includes("${")) {
      score += 1;
    }
  }

  return score >= 2;
}

async function detectSupportedLanguageForPath(absolutePath: string, name: string): Promise<"python" | "html" | "markdown" | "javascript" | "typescript" | "yaml" | "shell" | "dockerfile" | "css" | null> {
  const directMatch = detectSupportedLanguage(name);
  if (directMatch) {
    return directMatch;
  }

  if (extname(name) !== "" || name.startsWith(".")) {
    return null;
  }

  try {
    const source = await readText(absolutePath);
    return looksLikeShellScript(source) ? "shell" : null;
  } catch (error) {
    if (isIgnorableFsError(error)) {
      return null;
    }
    throw error;
  }
}

export async function listSourceFiles(root: string): Promise<Array<{ absolutePath: string; relativePath: string; language: "python" | "html" | "markdown" | "javascript" | "typescript" | "yaml" | "shell" | "dockerfile" | "css" }>> {
  const files: Array<{ absolutePath: string; relativePath: string; language: "python" | "html" | "markdown" | "javascript" | "typescript" | "yaml" | "shell" | "dockerfile" | "css" }> = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (isIgnorableFsError(error)) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const language = await detectSupportedLanguageForPath(absolutePath, entry.name);
      if (!language) {
        continue;
      }

      files.push({
        absolutePath,
        relativePath: relative(root, absolutePath),
        language
      });
    }
  }

  await walk(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function fileMetadata(path: string): Promise<{ size: number; mtimeMs: number }> {
  try {
    const details = await stat(path);
    return {
      size: details.size,
      mtimeMs: details.mtimeMs
    };
  } catch (error) {
    if (isIgnorableFsError(error)) {
      return {
        size: 0,
        mtimeMs: 0
      };
    }
    throw error;
  }
}

async function bootstrapAgentInstructions(root: string, setupType: SetupType): Promise<void> {
  const templates = await loadInstructionTemplates(root, setupType);
  await writeFile(appPath(root, BIN_DIR, LOCAL_WINDOWS_WRAPPER), renderWindowsWrapper(), "utf8");
  await writeFile(appPath(root, BIN_DIR, LOCAL_POWERSHELL_WRAPPER), renderPowerShellWrapper(), "utf8");
  await writeFile(appPath(root, BIN_DIR, LOCAL_POSIX_WRAPPER), renderPosixWrapper(), "utf8");
  await writeFile(appPath(root, INSTRUCTIONS_DIR, LOCAL_ADOPTION_GUIDE), templates.adoptionGuide, "utf8");
  await writeFile(appPath(root, INSTRUCTIONS_DIR, LOCAL_AGENTS_SNIPPET), templates.agentsSnippet, "utf8");
  await writeFile(appPath(root, INSTRUCTIONS_DIR, LOCAL_CLAUDE_SNIPPET), templates.claudeSnippet, "utf8");
  if (setupType === "cli") {
    await rm(appPath(root, TOOLS_DIR), { recursive: true, force: true });
  } else {
    await mkdir(appPath(root, TOOLS_DIR), { recursive: true });
    await writeFile(appPath(root, TOOLS_DIR, LOCAL_TOOLS_MANIFEST), renderToolManifest(root, setupType), "utf8");
    await writeFile(appPath(root, TOOLS_DIR, LOCAL_TOOLS_README), renderToolsReadme(setupType), "utf8");
  }

  await upsertManagedInstructionBlock(join(root, "AGENTS.md"), templates.agentsSnippet);
  await upsertManagedInstructionBlock(join(root, "CLAUDE.md"), templates.claudeSnippet);
}

async function ensureGitignoreEntry(root: string, entry: string): Promise<boolean> {
  const path = join(root, GITIGNORE_FILE);
  const current = await readOptionalText(path);
  const normalizedEntry = entry.trim();

  if (!current || current.trim().length === 0) {
    await writeFile(path, `${normalizedEntry}\n`, "utf8");
    return true;
  }

  const lines = current.split(/\r?\n/);
  if (lines.some((line) => line.trim() === normalizedEntry)) {
    return false;
  }

  const separator = current.endsWith("\n") ? "" : "\n";
  await writeFile(path, `${current}${separator}${normalizedEntry}\n`, "utf8");
  return true;
}

async function appearsGitTracked(root: string, pathSpec: string): Promise<boolean> {
  if (!(await exists(join(root, ".git")))) {
    return false;
  }

  try {
    const proc = Bun.spawn({
      cmd: ["git", "ls-files", "--", pathSpec],
      cwd: root,
      stdout: "pipe",
      stderr: "ignore"
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return exitCode === 0 && output.trim().length > 0;
  } catch {
    return false;
  }
}

async function loadInstructionTemplates(root: string, setupType: SetupType): Promise<{
  adoptionGuide: string;
  agentsSnippet: string;
  claudeSnippet: string;
}> {
  const adoptionGuideSource = await readFile(ADOPTION_GUIDE_SOURCE, "utf8");
  const setupTypeNote = buildSetupTypeNote(setupType);

  return {
    adoptionGuide: renderInstructionTemplate(`${setupTypeNote}\n\n${adoptionGuideSource}`, root),
    agentsSnippet: renderInstructionTemplate(renderManagedSnippet("agents", setupType), root),
    claudeSnippet: renderInstructionTemplate(renderManagedSnippet("claude", setupType), root)
  };
}

function renderInstructionTemplate(template: string, root: string): string {
  return template
    .replaceAll("<SYMBALLIST_ROOT>", SYMBALLIST_ROOT)
    .replaceAll("<PROJECT_ROOT>", root);
}

function mergeConfig(root: string, config: Partial<SymballistConfig> | null | undefined, setupTypeOverride?: SetupType): SymballistConfig {
  const base = defaultConfig(root);
  return {
    ...base,
    ...config,
    root,
    setupType: setupTypeOverride ?? config?.setupType ?? base.setupType,
    languages: config?.languages ?? base.languages,
    embeddings: {
      ...base.embeddings,
      ...(config?.embeddings ?? {})
    }
  };
}

function renderWindowsWrapper(): string {
  return `@echo off
setlocal
bun "${SYMBALLIST_ROOT}\\src\\cli.ts" %*
`;
}

function renderPowerShellWrapper(): string {
  return `& bun "${SYMBALLIST_ROOT}\\src\\cli.ts" @args
`;
}

function renderPosixWrapper(): string {
  const posixRoot = SYMBALLIST_ROOT.replace(/\\/g, "/");
  return `#!/usr/bin/env sh
bun "${posixRoot}/src/cli.ts" "$@"
`;
}

function buildSetupTypeNote(setupType: SetupType): string {
  switch (setupType) {
    case "cli":
      return `> This repo was initialized with \`symballist init --setup-type cli\`.\n> Use the repo-local CLI wrappers in \`.symballist/bin/\` as the primary integration surface.`;
    case "tool":
      return `> This repo was initialized with \`symballist init --setup-type tool\`.\n> Prefer the generated tool-definition files in \`.symballist/tools/\`. Keep the CLI wrappers in \`.symballist/bin/\` as the execution backend and fallback path.`;
    case "hybrid":
    default:
      return `> This repo was initialized with \`symballist init --setup-type hybrid\`.\n> Prefer the generated tool-definition files in \`.symballist/tools/\` when your agent runtime can load them, and fall back to the repo-local CLI wrappers in \`.symballist/bin/\` when it cannot.`;
  }
}

function renderManagedSnippet(target: "agents" | "claude", setupType: SetupType): string {
  if (setupType === "cli") {
    return target === "agents" ? renderCliAgentsSnippet() : renderCliClaudeSnippet();
  }
  if (setupType === "tool") {
    return target === "agents" ? renderToolAgentsSnippet() : renderToolClaudeSnippet();
  }
  return target === "agents" ? renderHybridAgentsSnippet() : renderHybridClaudeSnippet();
}

function renderCliAgentsSnippet(): string {
  return `## Symballist Retrieval

Use \`symballist\` as a CLI-first read-only retrieval helper for this repo.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- If \`symballist\` is installed globally or linked, prefer the plain \`symballist\` command when working from this repo root.
- Preferred local entrypoints:
  - bash / zsh / sh: \`./.symballist/bin/symballist\`
  - PowerShell / cmd.exe: \`.\\.symballist\\bin\\symballist.cmd\`
- Check freshness first:
  - \`symballist status\`
- Use the \`changeAwareness\` block from \`status\` when you want a cheap answer to what changed since the last index or, in git repos, since \`HEAD\`.
- Use the \`embeddings\` block from \`status\` when you want to know whether hybrid retrieval is configured and available for the active model.
- If the index is stale, refresh it before relying on results:
  - \`symballist index\`
- If you want a one-shot freshness sweep that automatically reuses incremental indexing:
  - \`symballist watch --once\`
- Use lookup for the common \`query -> top hit -> show\` flow:
  - \`symballist lookup "<text>"\`
- Use query for discovery:
  - \`symballist query "<text>"\`
  - Add \`--code-only --exclude-tests\` for implementation-heavy results.
  - Add \`--prefer-implementation\` when broad code queries still lean toward wiring or references.
  - Add \`--docs-only\` when you are explicitly looking for workflows, plans, or architecture notes.
- Use show for full context and related symbols:
  - \`symballist show <id>\`
  - \`symballist show --name <symbol>\`
  - \`symballist show --name <symbol> --full\`
- If you are calling symballist from outside this repo root or cannot rely on a linked install, fall back to the repo-local wrappers or pass \`--root <PROJECT_ROOT>\` explicitly.
- Treat \`symballist\` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- \`.symballist\\instructions\\symballist-adoption.md\``;
}

function renderCliClaudeSnippet(): string {
  return `## Symballist Retrieval

Use \`symballist\` as a CLI-first read-only retrieval helper for this repo.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- If \`symballist\` is installed globally or linked, prefer the plain \`symballist\` command when working from this repo root.
- Preferred local entrypoints:
  - bash / zsh / sh: \`./.symballist/bin/symballist\`
  - PowerShell / cmd.exe: \`.\\.symballist\\bin\\symballist.cmd\`
- Run \`symballist status\` before trusting older results.
- If \`indexFreshness.stale\` is true, run \`symballist index\`.
- If you want a one-shot freshness sweep that automatically reuses incremental indexing, run \`symballist watch --once\`.
- Use \`symballist lookup "<text>"\` for the common \`query -> top hit -> show\` flow.
- Use \`query\` to discover relevant code or docs.
- Add \`--code-only --exclude-tests\` for implementation-heavy results.
- Add \`--prefer-implementation\` when broad code queries still lean toward wiring or references.
- Add \`--docs-only\` when you are explicitly looking for workflows, plans, or architecture notes.
- Use \`show\` to inspect a result with full body, spans, relations, and related symbols.
- If you already know the symbol, use \`symballist show --name <symbol>\`.
- If the symbol body is large, use \`symballist show --name <symbol> --full\`.
- If you are calling symballist from outside this repo root or cannot rely on a linked install, fall back to the repo-local wrappers or pass \`--root <PROJECT_ROOT>\` explicitly.
- Verify important conclusions in the source files before making changes.
- If \`symballist\` misses, use normal file search and direct reads.

Reference:
- \`.symballist\\instructions\\symballist-adoption.md\``;
}

function renderToolAgentsSnippet(): string {
  return `## Symballist Retrieval

Use the generated repo-local \`symballist\` tool definitions as the preferred retrieval interface for this repo.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- Preferred tool-definition manifest:
  - \`.symballist\\tools\\symballist-tools.json\`
- Tooling guide:
  - \`.symballist\\tools\\README.md\`
- Preferred tools:
  - \`symballist_status\`
  - \`symballist_refresh\`
  - \`symballist_lookup\`
  - \`symballist_query\`
  - \`symballist_show\`
- If \`symballist\` is installed globally or linked, the plain CLI command is the simplest manual fallback when working from this repo root.
- Shell-specific CLI fallbacks:
  - bash / zsh / sh: \`./.symballist/bin/symballist\`
  - PowerShell / cmd.exe: \`.\\.symballist\\bin\\symballist.cmd\`
- Use \`symballist_status\` first to inspect freshness, change awareness, and embeddings state.
- If the repo is stale, use \`symballist_refresh\` before relying on retrieval output.
- Prefer \`symballist_lookup\` for the common \`query -> top hit -> show\` flow.
- Use \`symballist_query\` when you want to inspect multiple ranked candidates manually.
- Use \`symballist_show\` when you already know the symbol id or exact name.
- If the runtime cannot load the generated tool definitions, fall back to \`.symballist\\bin\\symballist.cmd\`.
- Treat \`symballist\` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- \`.symballist\\instructions\\symballist-adoption.md\``;
}

function renderToolClaudeSnippet(): string {
  return `## Symballist Retrieval

Use the generated repo-local \`symballist\` tool definitions as the preferred retrieval interface for this repo.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- Tool-definition manifest: \`.symballist\\tools\\symballist-tools.json\`
- Tooling guide: \`.symballist\\tools\\README.md\`
- If \`symballist\` is installed globally or linked, the plain CLI command is the simplest manual fallback when working from this repo root.
- Shell-specific CLI fallbacks:
  - bash / zsh / sh: \`./.symballist/bin/symballist\`
  - PowerShell / cmd.exe: \`.\\.symballist\\bin\\symballist.cmd\`
- Start with \`symballist_status\` to check freshness and embeddings state.
- Use \`symballist_refresh\` when the repo is stale.
- Use \`symballist_lookup\` for the common single-call discovery flow.
- Use \`symballist_query\` when you want to inspect multiple candidates.
- Use \`symballist_show\` when you already know the symbol id or exact name.
- If the runtime cannot load the generated tool definitions, fall back to \`.symballist\\bin\\symballist.cmd\`.
- Verify important conclusions in the source files before making changes.
- If \`symballist\` misses, use normal file search and direct reads.

Reference:
- \`.symballist\\instructions\\symballist-adoption.md\``;
}

function renderHybridAgentsSnippet(): string {
  return `## Symballist Retrieval

Use the generated repo-local \`symballist\` tool definitions when your agent runtime can load them. Keep the repo-local CLI wrappers as the robust fallback.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- Preferred tool-definition manifest:
  - \`.symballist\\tools\\symballist-tools.json\`
- Tooling guide:
  - \`.symballist\\tools\\README.md\`
- Preferred tools:
  - \`symballist_status\`
  - \`symballist_refresh\`
  - \`symballist_lookup\`
  - \`symballist_query\`
  - \`symballist_show\`
- If \`symballist\` is installed globally or linked, the plain CLI command is the simplest manual fallback when working from this repo root.
- CLI fallback entrypoints:
  - bash / zsh / sh: \`./.symballist/bin/symballist\`
  - PowerShell / cmd.exe: \`.\\.symballist\\bin\\symballist.cmd\`
- Use \`symballist_status\` first or run \`symballist status\`.
- If the repo is stale, use \`symballist_refresh\` or run \`symballist watch --once\`.
- Prefer \`symballist_lookup\` for the common \`query -> top hit -> show\` flow.
- Use \`symballist_query\` / \`symballist_show\` when you want more manual control, or use the equivalent CLI commands if tool loading is unavailable.
- If you are calling symballist from outside this repo root or cannot rely on a linked install, fall back to the repo-local wrappers or pass \`--root <PROJECT_ROOT>\` explicitly.
- Treat \`symballist\` as a helper, not the sole source of truth.
- If results are weak or stale, fall back to normal file reads or search.

Reference:
- \`.symballist\\instructions\\symballist-adoption.md\``;
}

function renderHybridClaudeSnippet(): string {
  return `## Symballist Retrieval

Use the generated repo-local \`symballist\` tool definitions when your runtime can load them, and fall back to the repo-local CLI wrappers when it cannot.

Current language coverage:
- Python, JavaScript, TypeScript, HTML, Markdown, YAML, shell / bash / zsh, Dockerfile / Containerfile, and CSS

- Tool-definition manifest: \`.symballist\\tools\\symballist-tools.json\`
- Tooling guide: \`.symballist\\tools\\README.md\`
- If \`symballist\` is installed globally or linked, the plain CLI command is the simplest manual fallback when working from this repo root.
- CLI fallback entrypoints:
  - bash / zsh / sh: \`./.symballist/bin/symballist\`
  - PowerShell / cmd.exe: \`.\\.symballist\\bin\\symballist.cmd\`
- Start with \`symballist_status\` or \`symballist status\`.
- Refresh stale indexes with \`symballist_refresh\` or \`symballist watch --once\`.
- Prefer \`symballist_lookup\` for the common single-call discovery flow.
- Use \`symballist_query\` and \`symballist_show\` when you need more manual inspection.
- If you are calling symballist from outside this repo root or cannot rely on a linked install, fall back to the repo-local wrappers or pass \`--root <PROJECT_ROOT>\` explicitly.
- Verify important conclusions in the source files before making changes.
- If \`symballist\` misses, use normal file search and direct reads.

Reference:
- \`.symballist\\instructions\\symballist-adoption.md\``;
}

function renderToolManifest(root: string, setupType: SetupType): string {
  return JSON.stringify({
    version: 1,
    setupType,
    projectRoot: root,
    transport: "cli-wrapper",
    wrapper: {
      windows: ".symballist\\bin\\symballist.cmd",
      powershell: ".symballist\\bin\\symballist.ps1",
      posix: ".symballist/bin/symballist"
    },
    tools: [
      {
        name: "symballist_status",
        description: "Inspect index freshness, change awareness, and embeddings state for the repo.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
        commandTemplate: [".symballist\\bin\\symballist.cmd", "status"]
      },
      {
        name: "symballist_refresh",
        description: "Perform a one-shot freshness sweep and incremental refresh if needed.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
        commandTemplate: [".symballist\\bin\\symballist.cmd", "watch", "--once"]
      },
      {
        name: "symballist_query",
        description: "Return ranked retrieval candidates for code or docs.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            limit: { type: "integer", minimum: 1 },
            kind: {
              type: "array",
              items: { type: "string" }
            },
            codeOnly: { type: "boolean" },
            docsOnly: { type: "boolean" },
            excludeTests: { type: "boolean" },
            preferImplementation: { type: "boolean" }
          },
          required: ["text"],
          additionalProperties: false
        },
        commandTemplate: [".symballist\\bin\\symballist.cmd", "query", "<text>"]
      },
      {
        name: "symballist_lookup",
        description: "Run the common query-to-best-hit flow and return the resolved symbol plus alternatives.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            limit: { type: "integer", minimum: 1 },
            kind: {
              type: "array",
              items: { type: "string" }
            },
            codeOnly: { type: "boolean" },
            docsOnly: { type: "boolean" },
            excludeTests: { type: "boolean" },
            preferImplementation: { type: "boolean" },
            full: { type: "boolean" }
          },
          required: ["text"],
          additionalProperties: false
        },
        commandTemplate: [".symballist\\bin\\symballist.cmd", "lookup", "<text>"]
      },
      {
        name: "symballist_show",
        description: "Resolve a result id or exact symbol name into full stored context.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1 },
            name: { type: "string" },
            full: { type: "boolean" }
          },
          additionalProperties: false
        },
        commandTemplate: [".symballist\\bin\\symballist.cmd", "show", "<id-or-name>"]
      }
    ]
  }, null, 2);
}

function renderToolsReadme(setupType: SetupType): string {
  return `# Symballist Tool Definitions

This repo was initialized with \`setupType: ${setupType}\`.

The file \`symballist-tools.json\` contains repo-local tool definitions that wrap the generated CLI entrypoints in \`.symballist/bin/\`.

Recommended use:

- load the generated tool definitions into your agent runtime if it supports repo-local tools
- prefer \`symballist_status\`, \`symballist_refresh\`, \`symballist_lookup\`, \`symballist_query\`, and \`symballist_show\`
- if this checkout was linked with \`bun link\`, the plain \`symballist\` command is the simplest manual fallback from the target repo root
- keep shell-appropriate CLI wrappers as the execution backend and universal fallback
  - bash / zsh / sh: \`./.symballist/bin/symballist\`
  - PowerShell / cmd.exe: \`.\\.symballist\\bin\\symballist.cmd\`

These definitions are intentionally vendor-neutral. They are meant to be adapted to Anthropic, OpenAI, or other local tool-loading flows without removing the CLI fallback path.
`;
}

async function upsertManagedInstructionBlock(path: string, content: string): Promise<void> {
  const managedBlock = `${MANAGED_BLOCK_START}\n${content.trim()}\n${MANAGED_BLOCK_END}\n`;
  const current = await readOptionalText(path);

  if (current === null || current.trim().length === 0) {
    await writeFile(path, managedBlock, "utf8");
    return;
  }

  const blockPattern = new RegExp(`${escapeRegExp(MANAGED_BLOCK_START)}[\\s\\S]*?${escapeRegExp(MANAGED_BLOCK_END)}\\r?\\n?`, "m");
  if (blockPattern.test(current)) {
    const updated = current.replace(blockPattern, managedBlock);
    await writeFile(path, updated, "utf8");
    return;
  }

  const separator = current.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(path, `${current}${separator}${managedBlock}`, "utf8");
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isIgnorableFsError(error)) {
      return null;
    }
    throw error;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
