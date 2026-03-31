import { APP_DIR, CONFIG_FILE, DB_FILE, SUPPORTED_EXTENSIONS, appPath } from "../config.ts";
import { CURRENT_SCHEMA_VERSION, getIndexedFiles, getLatestSymbolChangeSummary, getStatusSummary, openDatabase } from "../db.ts";
import { summarizeEmbeddingSupport } from "../embeddings.ts";
import { detectGitHeadFileChanges, detectIndexFileChanges, detectIndexFreshness, summarizeFileChanges } from "../freshness.ts";
import { exists, readConfig } from "../fs.ts";
import { getShellGuidance } from "../shell.ts";

function defaultLanguages(): string[] {
  return [...new Set(SUPPORTED_EXTENSIONS.values())].sort();
}

export async function runStatus(root: string): Promise<void> {
  const configPath = appPath(root, CONFIG_FILE);
  const dbPath = appPath(root, DB_FILE);
  const config = await readConfig(root);
  const dbExists = await exists(dbPath);
  const shellGuidance = getShellGuidance(root);

  let indexedFileCount = 0;
  let indexedSymbols = 0;
  let fallbackSymbols = 0;
  let indexedSchemaVersion: number | null = null;
  let languages = config?.languages ?? defaultLanguages();
  let freshness = {
    stale: false,
    changedFiles: 0,
    newFiles: 0,
    deletedFiles: 0
  };
  let changeAwareness = {
    sinceIndex: {
      changedFiles: 0,
      newFiles: 0,
      deletedFiles: 0,
      changedPaths: [] as string[],
      newPaths: [] as string[],
      deletedPaths: [] as string[],
      truncated: false
    },
    symbolChangesSinceIndex: {
      addedCount: 0,
      removedCount: 0,
      changedCount: 0,
      added: [] as Array<{ path: string; kind: string; name: string }>,
      removed: [] as Array<{ path: string; kind: string; name: string }>,
      changed: [] as Array<{ path: string; kind: string; name: string }>,
      truncated: false
    },
    sinceGitHead: {
      available: false,
      changedFiles: 0,
      newFiles: 0,
      deletedFiles: 0,
      changedPaths: [] as string[],
      newPaths: [] as string[],
      deletedPaths: [] as string[],
      truncated: false
    }
  };
  let embeddings = {
    enabled: Boolean(config?.embeddings?.enabled),
    configured: Boolean(config?.embeddings?.enabled),
    available: false,
    provider: config?.embeddings?.provider ?? null,
    model: config?.embeddings?.model ?? null,
    baseUrl: config?.embeddings?.baseUrl ?? null,
    indexedEmbeddings: 0,
    matchedEmbeddings: 0,
    reason: config?.embeddings?.enabled ? "no_indexed_embeddings_for_active_model" : "disabled"
  };

  if (dbExists) {
    const db = await openDatabase(root);
    const summary = getStatusSummary(db);
    const indexedRows = getIndexedFiles(db);
    const symbolChanges = getLatestSymbolChangeSummary(db);
    embeddings = summarizeEmbeddingSupport(db, config);
    db.close();
    indexedFileCount = summary.indexedFiles;
    indexedSymbols = summary.indexedSymbols;
    fallbackSymbols = summary.fallbackSymbols;
    indexedSchemaVersion = summary.schemaVersion;
    if (summary.languages.length > 0) {
      languages = summary.languages;
    }
    freshness = await detectIndexFreshness(root, indexedRows);
    const indexChanges = await detectIndexFileChanges(root, indexedRows);
    changeAwareness = {
      sinceIndex: summarizeFileChanges(indexChanges),
      symbolChangesSinceIndex: symbolChanges,
      sinceGitHead: await detectGitHeadFileChanges(root, new Set([
        ...indexedRows.map((row) => row.path),
        ...indexChanges.changedPaths,
        ...indexChanges.newPaths,
        ...indexChanges.deletedPaths
      ]))
    };
  }

  console.log(JSON.stringify({
    root,
    appDir: appPath(root),
    configPath,
    dbPath,
    initialized: config !== null,
    appDirExists: await exists(appPath(root)),
    configExists: config !== null,
    dbExists,
    supportedLanguages: languages,
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    indexedSchemaVersion,
    indexedFiles: indexedFileCount,
    indexedSymbols,
    fallbackSymbols,
    setupType: config?.setupType ?? null,
    shellGuidance,
    embeddings,
    indexFreshness: freshness,
    changeAwareness
  }, null, 2));
}
