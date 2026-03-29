import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { APP_DIR, CACHE_DIR, CONFIG_FILE, LOGS_DIR, SUPPORTED_EXTENSIONS, appPath, defaultConfig } from "./config.ts";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  APP_DIR,
  "backlog"
]);

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

export async function listSourceFiles(root: string): Promise<Array<{ absolutePath: string; relativePath: string; language: "python" | "html" }>> {
  const files: Array<{ absolutePath: string; relativePath: string; language: "python" | "html" }> = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
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
  const details = await stat(path);
  return {
    size: details.size,
    mtimeMs: details.mtimeMs
  };
}
