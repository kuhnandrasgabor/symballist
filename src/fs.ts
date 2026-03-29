import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
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

function isIgnorableFsError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }
  return error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOENT";
}

export async function ensureInitialized(root: string): Promise<void> {
  await mkdir(appPath(root), { recursive: true });
  await mkdir(appPath(root, CACHE_DIR), { recursive: true });
  await mkdir(appPath(root, LOGS_DIR), { recursive: true });

  const config = JSON.stringify(defaultConfig(root), null, 2);
  await writeFile(appPath(root, CONFIG_FILE), config, { flag: "w" });
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

  return JSON.parse(await readText(path)) as SymballistConfig;
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
