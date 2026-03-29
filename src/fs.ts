import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_DIR, CACHE_DIR, CONFIG_FILE, LOGS_DIR, SUPPORTED_EXTENSIONS, appPath, defaultConfig } from "./config.ts";
import type { SymballistConfig } from "./config.ts";

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
const LOCAL_ADOPTION_GUIDE = "symballist-adoption.md";
const LOCAL_AGENTS_SNIPPET = "AGENTS.symballist.md";
const LOCAL_CLAUDE_SNIPPET = "CLAUDE.symballist.md";
const LOCAL_WINDOWS_WRAPPER = "symballist.cmd";
const LOCAL_POWERSHELL_WRAPPER = "symballist.ps1";
const LOCAL_POSIX_WRAPPER = "symballist";
const GITIGNORE_FILE = ".gitignore";
const APP_GITIGNORE_ENTRY = ".symballist/";
const MANAGED_BLOCK_START = "<!-- SYMBALLIST RETRIEVAL START -->";
const MANAGED_BLOCK_END = "<!-- SYMBALLIST RETRIEVAL END -->";
const SYMBALLIST_ROOT = normalize(fileURLToPath(new URL("..", import.meta.url))).replace(/[\\\/]+$/, "");
const ADOPTION_GUIDE_SOURCE = fileURLToPath(new URL("../docs/agent-workflows/symballist-adoption.md", import.meta.url));
const AGENTS_SNIPPET_SOURCE = fileURLToPath(new URL("../docs/snippets/downstream-agents-symballist.md", import.meta.url));
const CLAUDE_SNIPPET_SOURCE = fileURLToPath(new URL("../docs/snippets/downstream-claude-symballist.md", import.meta.url));

function isIgnorableFsError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }
  return error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOENT";
}

export async function ensureInitialized(root: string): Promise<void> {
  await mkdir(appPath(root), { recursive: true });
  await mkdir(appPath(root, BIN_DIR), { recursive: true });
  await mkdir(appPath(root, CACHE_DIR), { recursive: true });
  await mkdir(appPath(root, LOGS_DIR), { recursive: true });
  await mkdir(appPath(root, INSTRUCTIONS_DIR), { recursive: true });

  const existingConfig = await readConfig(root);
  await writeConfig(root, mergeConfig(root, existingConfig));
  await bootstrapAgentInstructions(root);
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

export async function listSourceFiles(root: string): Promise<Array<{ absolutePath: string; relativePath: string; language: "python" | "html" | "markdown" }>> {
  const files: Array<{ absolutePath: string; relativePath: string; language: "python" | "html" | "markdown" }> = [];

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

      const language = SUPPORTED_EXTENSIONS.get(extname(entry.name).toLowerCase());
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

async function bootstrapAgentInstructions(root: string): Promise<void> {
  const templates = await loadInstructionTemplates(root);
  await writeFile(appPath(root, BIN_DIR, LOCAL_WINDOWS_WRAPPER), renderWindowsWrapper(), "utf8");
  await writeFile(appPath(root, BIN_DIR, LOCAL_POWERSHELL_WRAPPER), renderPowerShellWrapper(), "utf8");
  await writeFile(appPath(root, BIN_DIR, LOCAL_POSIX_WRAPPER), renderPosixWrapper(), "utf8");
  await writeFile(appPath(root, INSTRUCTIONS_DIR, LOCAL_ADOPTION_GUIDE), templates.adoptionGuide, "utf8");
  await writeFile(appPath(root, INSTRUCTIONS_DIR, LOCAL_AGENTS_SNIPPET), templates.agentsSnippet, "utf8");
  await writeFile(appPath(root, INSTRUCTIONS_DIR, LOCAL_CLAUDE_SNIPPET), templates.claudeSnippet, "utf8");

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

async function loadInstructionTemplates(root: string): Promise<{
  adoptionGuide: string;
  agentsSnippet: string;
  claudeSnippet: string;
}> {
  const [adoptionGuideSource, agentsSnippetSource, claudeSnippetSource] = await Promise.all([
    readFile(ADOPTION_GUIDE_SOURCE, "utf8"),
    readFile(AGENTS_SNIPPET_SOURCE, "utf8"),
    readFile(CLAUDE_SNIPPET_SOURCE, "utf8")
  ]);

  return {
    adoptionGuide: renderInstructionTemplate(adoptionGuideSource, root),
    agentsSnippet: renderInstructionTemplate(agentsSnippetSource, root),
    claudeSnippet: renderInstructionTemplate(claudeSnippetSource, root)
  };
}

function renderInstructionTemplate(template: string, root: string): string {
  return template
    .replaceAll("<SYMBALLIST_ROOT>", SYMBALLIST_ROOT)
    .replaceAll("<PROJECT_ROOT>", root);
}

function mergeConfig(root: string, config: Partial<SymballistConfig> | null | undefined): SymballistConfig {
  const base = defaultConfig(root);
  return {
    ...base,
    ...config,
    root,
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
