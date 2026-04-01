import { deleteFileIndex, getEmbeddingCountForPath, getEmbeddableSymbolsForPath, getIndexCompatibility, getIndexedFiles, markCurrentIndexFormat, openDatabase, rebuildStoredIndex, recordImpactTrackingEvent, replaceFileIndex, resetLatestSymbolChangeSummary, setIndexedScopeSignature } from "../db.ts";
import { getActiveEmbeddingsConfig, updateEmbeddingsForSymbols } from "../embeddings.ts";
import { fileMetadata, listSourceFiles, readConfig, readRepoScopeControl, readText } from "../fs.ts";
import { extractSymbols } from "../indexer/index.ts";

export type IndexStats = {
  discoveredFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  removedFiles: number;
  indexedSymbols: number;
  embeddedSymbols: number;
  embeddingError: string | null;
};

type RunIndexOptions = {
  progress?: boolean;
  emitStats?: boolean;
  rebuild?: boolean;
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
  const config = await readConfig(root);
  const scope = await readRepoScopeControl(root);
  const embeddings = getActiveEmbeddingsConfig(config);
  const db = await openDatabase(root);
  const indexCompatibility = getIndexCompatibility(db);
  const shouldRebuild = options.rebuild === true || indexCompatibility.requiresRebuild;
  if (shouldRebuild) {
    rebuildStoredIndex(db);
  } else {
    resetLatestSymbolChangeSummary(db);
  }
  const files = await listSourceFiles(root, { scope });
  const currentPaths = new Set(files.map((file) => file.relativePath));
  const existingFiles = shouldRebuild
    ? new Map<string, ReturnType<typeof getIndexedFiles>[number]>()
    : new Map(getIndexedFiles(db).map((file) => [file.path, file]));

  const stats: IndexStats = {
    discoveredFiles: files.length,
    indexedFiles: 0,
    skippedFiles: 0,
    removedFiles: 0,
    indexedSymbols: 0,
    embeddedSymbols: 0,
    embeddingError: null
  };
  const progressState: ProgressState = {
    lastRenderedLength: 0,
    lastLoggedStep: 0
  };

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const metadata = await fileMetadata(file.absolutePath);
    const existing = existingFiles.get(file.relativePath);
    const shouldBackfillEmbeddings = Boolean(
      existing
      && embeddings
      && getEmbeddingCountForPath(db, file.relativePath, embeddings.provider, embeddings.model) === 0
    );

    if (existing && existing.size === metadata.size && existing.mtimeMs === metadata.mtimeMs && !shouldBackfillEmbeddings) {
      stats.skippedFiles += 1;
      if (progress) {
        renderProgress(index + 1, files.length, stats, file.relativePath, progressState);
      }
      continue;
    }

    if (shouldBackfillEmbeddings) {
      try {
        const embeddableSymbols = getEmbeddableSymbolsForPath(db, file.relativePath);
        stats.embeddedSymbols += await updateEmbeddingsForSymbols(db, embeddings, embeddableSymbols);
      } catch (error) {
        stats.embeddingError = error instanceof Error ? error.message : String(error);
      }
      stats.skippedFiles += 1;
      if (progress) {
        renderProgress(index + 1, files.length, stats, file.relativePath, progressState);
      }
      continue;
    }

    const source = await readText(file.absolutePath);
    const symbols = extractSymbols(file.relativePath, file.language, source, { availablePaths: currentPaths });
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
    if (embeddings && stats.embeddingError === null) {
      try {
        const embeddableSymbols = getEmbeddableSymbolsForPath(db, file.relativePath);
        stats.embeddedSymbols += await updateEmbeddingsForSymbols(db, embeddings, embeddableSymbols);
      } catch (error) {
        stats.embeddingError = error instanceof Error ? error.message : String(error);
      }
    }
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

  markCurrentIndexFormat(db);
  setIndexedScopeSignature(db, scope.signature);
  if (shouldRebuild) {
    // A full rebuild establishes a fresh baseline, so symbol-change noise from
    // rebuilding every file should not persist into subsequent status calls.
    resetLatestSymbolChangeSummary(db);
  }

  if (config?.impactTracking?.enabled) {
    recordImpactTrackingEvent(db, {
      command: "index",
      timestamp: new Date().toISOString(),
      payloadChars: JSON.stringify(stats).length,
      compact: false,
      selectedResult: false,
      staleIndex: shouldRebuild
    });
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
