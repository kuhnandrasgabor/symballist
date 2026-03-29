import { join } from "node:path";

export const APP_DIR = ".symballist";
export const CONFIG_FILE = "config.json";
export const DB_FILE = "index.db";
export const CACHE_DIR = "cache";
export const LOGS_DIR = "logs";

export const SUPPORTED_EXTENSIONS = new Map<string, "python" | "html">([
  [".py", "python"],
  [".html", "html"],
  [".htm", "html"]
]);

export function appPath(root: string, ...segments: string[]): string {
  return join(root, APP_DIR, ...segments);
}

export function defaultConfig(root: string) {
  return {
    version: 1,
    root,
    languages: ["python", "html"],
    createdAt: new Date().toISOString()
  };
}
