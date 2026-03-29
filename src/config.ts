import { join } from "node:path";

export const APP_DIR = ".symballist";
export const CONFIG_FILE = "config.json";
export const DB_FILE = "index.db";
export const CACHE_DIR = "cache";
export const LOGS_DIR = "logs";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_EMBED_MODEL = "all-minilm";

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
  embeddings: {
    enabled: boolean;
    provider: "ollama";
    baseUrl: string;
    model: string;
    dimensions: number | null;
  };
};

export function defaultConfig(root: string): SymballistConfig {
  return {
    version: 2,
    root,
    languages: ["python", "html", "markdown"],
    createdAt: new Date().toISOString(),
    embeddings: {
      enabled: false,
      provider: "ollama",
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      model: DEFAULT_OLLAMA_EMBED_MODEL,
      dimensions: null
    }
  };
}
