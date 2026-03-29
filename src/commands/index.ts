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
  emitStats?: boolean;
};

type ProgressState = {
  lastRenderedLength: number;
  lastLoggedStep: number;
};

function truncateMiddle(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }
  if (maxLength <= 3) {
    return ".".repeat(maxLength);
  }

  const left = Math.ceil((maxLength - 3) / 2);
  const right = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, left)}...${value.slice(value.length - right)}`;
}

function formatProgressLine(current: number, total: number, stats: IndexStats, currentPath: string, maxWidth: number): string {
  const width = 24;
  const ratio = total > 0 ? current / total : 1;
  const filled = Math.round(width * ratio);
  const bar = `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
  const prefix = `[index] [${bar}] ${current}/${total} indexed:${stats.indexedFiles} skipped:${stats.skippedFiles} symbols:${stats.indexedSymbols} `;
  const availablePath = Math.max(0, maxWidth - prefix.length);
  return `${prefix}${truncateMiddle(currentPath, availablePath)}`;
}

function renderProgress(current: number, total: number, stats: IndexStats, currentPath: string, state: ProgressState): void {
  if (process.stdout.isTTY) {
    const maxWidth = Math.max(process.stdout.columns ?? 100, 40);
    const line = formatProgressLine(current, total, stats, currentPath, maxWidth);
    const padded = line.padEnd(Math.max(state.lastRenderedLength, line.length), " ");
    state.lastRenderedLength = padded.length;
    process.stdout.write(`\r${padded}`);
    return;
  }

  const shouldLog = current === 1 || current === total || current - state.lastLoggedStep >= 25;
  if (!shouldLog) {
    return;
  }

  state.lastLoggedStep = current;
  console.error(formatProgressLine(current, total, stats, currentPath, 120));
}

export async function runIndex(root: string, options: RunIndexOptions = {}): Promise<IndexStats> {
  const progress = options.progress ?? true;
  const emitStats = options.emitStats ?? true;
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
  const progressState: ProgressState = {
    lastRenderedLength: 0,
    lastLoggedStep: 0
  };

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const metadata = await fileMetadata(file.absolutePath);
    const existing = existingFiles.get(file.relativePath);

    if (existing && existing.size === metadata.size && existing.mtimeMs === metadata.mtimeMs) {
      stats.skippedFiles += 1;
      if (progress) {
        renderProgress(index + 1, files.length, stats, file.relativePath, progressState);
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
      symbols,
      { availablePaths: currentPaths }
    );
    stats.indexedFiles += 1;

    if (progress) {
      renderProgress(index + 1, files.length, stats, file.relativePath, progressState);
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

  if (emitStats) {
    console.log(JSON.stringify(stats, null, 2));
  }
  return stats;
}
