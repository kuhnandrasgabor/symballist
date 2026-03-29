import { deleteFileIndex, getIndexedFiles, openDatabase, replaceFileIndex } from "../db.ts";
import { fileMetadata, listSourceFiles, readText } from "../fs.ts";
import { extractSymbols } from "../indexer/index.ts";

export type IndexStats = {
  discoveredFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  removedFiles: number;
  indexedSymbols: number;
};

type RunIndexOptions = {
  progress?: boolean;
};

function renderProgress(current: number, total: number, stats: IndexStats, currentPath: string): void {
  const width = 24;
  const ratio = total > 0 ? current / total : 1;
  const filled = Math.round(width * ratio);
  const bar = `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
  const line = `[index] [${bar}] ${current}/${total} indexed:${stats.indexedFiles} skipped:${stats.skippedFiles} symbols:${stats.indexedSymbols} ${currentPath}`;
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}`);
  } else {
    console.error(line);
  }
}

export async function runIndex(root: string, options: RunIndexOptions = {}): Promise<IndexStats> {
  const progress = options.progress ?? true;
  const db = await openDatabase(root);
  const files = await listSourceFiles(root);
  const currentPaths = new Set(files.map((file) => file.relativePath));
  const existingFiles = new Map(getIndexedFiles(db).map((file) => [file.path, file]));

  const stats: IndexStats = {
    discoveredFiles: files.length,
    indexedFiles: 0,
    skippedFiles: 0,
    removedFiles: 0,
    indexedSymbols: 0
  };

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const metadata = await fileMetadata(file.absolutePath);
    const existing = existingFiles.get(file.relativePath);

    if (existing && existing.size === metadata.size && existing.mtimeMs === metadata.mtimeMs) {
      stats.skippedFiles += 1;
      if (progress) {
        renderProgress(index + 1, files.length, stats, file.relativePath);
      }
      continue;
    }

    const source = await readText(file.absolutePath);
    const symbols = extractSymbols(file.relativePath, file.language, source);
    stats.indexedSymbols += replaceFileIndex(
      db,
      {
        path: file.relativePath,
        language: file.language,
        size: metadata.size,
        mtimeMs: metadata.mtimeMs
      },
      symbols
    );
    stats.indexedFiles += 1;

    if (progress) {
      renderProgress(index + 1, files.length, stats, file.relativePath);
    }
  }

  for (const existingPath of existingFiles.keys()) {
    if (!currentPaths.has(existingPath)) {
      deleteFileIndex(db, existingPath);
      stats.removedFiles += 1;
    }
  }

  db.close();

  if (progress && process.stdout.isTTY) {
    process.stdout.write("\n");
  }

  console.log(JSON.stringify(stats, null, 2));
  return stats;
}
