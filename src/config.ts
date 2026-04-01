import { join } from "node:path";

export const APP_DIR = ".symballist";
export const CONFIG_FILE = "config.json";
export const DB_FILE = "index.db";
export const CACHE_DIR = "cache";
export const LOGS_DIR = "logs";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_EMBED_MODEL = "nomic-embed-text:latest";

export type SetupType = "cli" | "tool" | "hybrid";
export type SupportedLanguage = "python" | "ruby" | "html" | "markdown" | "javascript" | "typescript" | "yaml" | "shell" | "dockerfile" | "css";
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["python", "ruby", "html", "markdown", "javascript", "typescript", "yaml", "shell", "dockerfile", "css"];

export const SUPPORTED_EXTENSIONS = new Map<string, Exclude<SupportedLanguage, "dockerfile">>([
  [".py", "python"],
  [".rb", "ruby"],
  [".html", "html"],
  [".htm", "html"],
  [".md", "markdown"],
  [".markdown", "markdown"],
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".sh", "shell"],
  [".bash", "shell"],
  [".zsh", "shell"],
  [".css", "css"]
]);

export const SUPPORTED_FILENAMES = new Map<string, "dockerfile">([
  ["dockerfile", "dockerfile"],
  ["containerfile", "dockerfile"]
]);

export function appPath(root: string, ...segments: string[]): string {
  return join(root, APP_DIR, ...segments);
}

export type SymballistConfig = {
  version: number;
  root: string;
  setupType: SetupType;
  languages: SupportedLanguage[];
  createdAt: string;
  embeddings: {
    enabled: boolean;
    provider: "ollama";
    baseUrl: string;
    model: string;
    dimensions: number | null;
  };
  impactTracking: {
    enabled: boolean;
  };
};

export function defaultConfig(root: string): SymballistConfig {
  return {
    version: 4,
    root,
    setupType: "hybrid",
    languages: [...SUPPORTED_LANGUAGES],
    createdAt: new Date().toISOString(),
    embeddings: {
      enabled: false,
      provider: "ollama",
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      model: DEFAULT_OLLAMA_EMBED_MODEL,
      dimensions: null
    },
    impactTracking: {
      enabled: false
    }
  };
}
