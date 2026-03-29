import { join } from "node:path";

export const APP_DIR = ".symballist";
export const CONFIG_FILE = "config.json";
export const DB_FILE = "index.db";
export const CACHE_DIR = "cache";
export const LOGS_DIR = "logs";

export const SUPPORTED_EXTENSIONS = new Map<string, "python" | "html" | "markdown">([
  [".py", "python"],
  [".html", "html"],
  [".htm", "html"],
  [".md", "markdown"],
  [".markdown", "markdown"]
]);

export function appPath(root: string, ...segments: string[]): string {
  return join(root, APP_DIR, ...segments);
}

export type SymballistConfig = {
  version: number;
  root: string;
  languages: Array<"python" | "html" | "markdown">;
  createdAt: string;
};

export function defaultConfig(root: string): SymballistConfig {
  return {
    version: 1,
    root,
    languages: ["python", "html", "markdown"],
    createdAt: new Date().toISOString()
  };
}
