import { defaultScopeSignature, fileMetadata, listSourceFiles, readRepoScopeControl } from "./fs.ts";
import type { IndexedFileRow } from "./db.ts";

const MTIME_EPSILON_MS = 10;
const DEFAULT_PATH_SAMPLE_LIMIT = 10;

export type IndexFreshness = {
  stale: boolean;
  changedFiles: number;
  newFiles: number;
  deletedFiles: number;
  scopeChanged: boolean;
};

export type FileChangeSet = {
  changedPaths: string[];
  newPaths: string[];
  deletedPaths: string[];
};

export type FileChangeSummary = {
  changedFiles: number;
  newFiles: number;
  deletedFiles: number;
  changedPaths: string[];
  newPaths: string[];
  deletedPaths: string[];
  truncated: boolean;
};

export type GitFileChangeSummary = FileChangeSummary & {
  available: boolean;
};

export async function detectIndexFileChanges(root: string, indexedFiles: IndexedFileRow[]): Promise<FileChangeSet> {
  const currentFiles = await listSourceFiles(root);
  const currentPaths = new Set(currentFiles.map((file) => file.relativePath));
  const indexedByPath = new Map(indexedFiles.map((file) => [file.path, file]));

  const changedPaths: string[] = [];
  const newPaths: string[] = [];

  for (const file of currentFiles) {
    const existing = indexedByPath.get(file.relativePath);
    if (!existing) {
      newPaths.push(file.relativePath);
      continue;
    }

    const metadata = await fileMetadata(file.absolutePath);
    if (existing.size !== metadata.size || Math.abs(existing.mtimeMs - metadata.mtimeMs) > MTIME_EPSILON_MS) {
      changedPaths.push(file.relativePath);
    }
  }

  const deletedPaths: string[] = [];
  for (const indexedPath of indexedByPath.keys()) {
    if (!currentPaths.has(indexedPath)) {
      deletedPaths.push(indexedPath);
    }
  }

  return {
    changedPaths: changedPaths.sort(),
    newPaths: newPaths.sort(),
    deletedPaths: deletedPaths.sort()
  };
}

export function summarizeFileChanges(changes: FileChangeSet, limit = DEFAULT_PATH_SAMPLE_LIMIT): FileChangeSummary {
  const changedPaths = changes.changedPaths.slice(0, limit);
  const newPaths = changes.newPaths.slice(0, limit);
  const deletedPaths = changes.deletedPaths.slice(0, limit);

  return {
    changedFiles: changes.changedPaths.length,
    newFiles: changes.newPaths.length,
    deletedFiles: changes.deletedPaths.length,
    changedPaths,
    newPaths,
    deletedPaths,
    truncated: changedPaths.length < changes.changedPaths.length
      || newPaths.length < changes.newPaths.length
      || deletedPaths.length < changes.deletedPaths.length
  };
}

export async function detectGitHeadFileChanges(
  root: string,
  relevantPaths: Set<string>,
  limit = DEFAULT_PATH_SAMPLE_LIMIT
): Promise<GitFileChangeSummary> {
  try {
    const proc = Bun.spawn({
      cmd: ["git", "status", "--porcelain=v1", "--untracked-files=all", "--ignored=no"],
      cwd: root,
      stdout: "pipe",
      stderr: "ignore"
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return {
        available: false,
        changedFiles: 0,
        newFiles: 0,
        deletedFiles: 0,
        changedPaths: [],
        newPaths: [],
        deletedPaths: [],
        truncated: false
      };
    }

    const changedPaths = new Set<string>();
    const newPaths = new Set<string>();
    const deletedPaths = new Set<string>();

    for (const line of output.split(/\r?\n/).filter(Boolean)) {
      if (line.length < 4) {
        continue;
      }

      const xy = line.slice(0, 2);
      const rawPath = line.slice(3).split(" -> ").at(-1)?.trim() ?? "";
      if (!rawPath) {
        continue;
      }

      const normalizedPath = rawPath.replace(/\//g, "\\");
      if (!relevantPaths.has(normalizedPath)) {
        continue;
      }

      if (xy === "??") {
        newPaths.add(normalizedPath);
        continue;
      }

      if (xy.includes("D")) {
        deletedPaths.add(normalizedPath);
        continue;
      }

      changedPaths.add(normalizedPath);
    }

    const summary = summarizeFileChanges({
      changedPaths: [...changedPaths].sort(),
      newPaths: [...newPaths].sort(),
      deletedPaths: [...deletedPaths].sort()
    }, limit);

    return {
      available: true,
      ...summary
    };
  } catch {
    return {
      available: false,
      changedFiles: 0,
      newFiles: 0,
      deletedFiles: 0,
      changedPaths: [],
      newPaths: [],
      deletedPaths: [],
      truncated: false
    };
  }
}

export async function detectIndexFreshness(
  root: string,
  indexedFiles: IndexedFileRow[],
  options: { indexedScopeSignature?: string | null } = {}
): Promise<IndexFreshness> {
  const changes = await detectIndexFileChanges(root, indexedFiles);
  const changedFiles = changes.changedPaths.length;
  const newFiles = changes.newPaths.length;
  const deletedFiles = changes.deletedPaths.length;
  const currentScope = await readRepoScopeControl(root);
  const indexedScopeSignature = options.indexedScopeSignature ?? defaultScopeSignature();
  const scopeChanged = indexedScopeSignature !== currentScope.signature;

  return {
    stale: changedFiles > 0 || newFiles > 0 || deletedFiles > 0 || scopeChanged,
    changedFiles,
    newFiles,
    deletedFiles,
    scopeChanged
  };
}
