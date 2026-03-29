import { fileMetadata, listSourceFiles } from "./fs.ts";
import type { IndexedFileRow } from "./db.ts";

export type IndexFreshness = {
  stale: boolean;
  changedFiles: number;
  newFiles: number;
  deletedFiles: number;
};

export async function detectIndexFreshness(root: string, indexedFiles: IndexedFileRow[]): Promise<IndexFreshness> {
  const currentFiles = await listSourceFiles(root);
  const currentPaths = new Set(currentFiles.map((file) => file.relativePath));
  const indexedByPath = new Map(indexedFiles.map((file) => [file.path, file]));

  let changedFiles = 0;
  let newFiles = 0;

  for (const file of currentFiles) {
    const existing = indexedByPath.get(file.relativePath);
    if (!existing) {
      newFiles += 1;
      continue;
    }

    const metadata = await fileMetadata(file.absolutePath);
    if (existing.size !== metadata.size || existing.mtimeMs !== metadata.mtimeMs) {
      changedFiles += 1;
    }
  }

  let deletedFiles = 0;
  for (const indexedPath of indexedByPath.keys()) {
    if (!currentPaths.has(indexedPath)) {
      deletedFiles += 1;
    }
  }

  return {
    stale: changedFiles > 0 || newFiles > 0 || deletedFiles > 0,
    changedFiles,
    newFiles,
    deletedFiles
  };
}
