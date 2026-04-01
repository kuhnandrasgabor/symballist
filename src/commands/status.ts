import { APP_DIR, CONFIG_FILE, DB_FILE, SUPPORTED_EXTENSIONS, appPath } from "../config.ts";
import { CURRENT_INDEX_FORMAT_VERSION, CURRENT_SCHEMA_VERSION, getImpactTrackingSummary, getIndexCompatibility, getIndexedFiles, getLatestSymbolChangeSummary, getLikelyGraphRoots, getPossibleOrphanCandidates, getStatusSummary, openDatabase, recordImpactTrackingEvent } from "../db.ts";
import { summarizeEmbeddingSupport } from "../embeddings.ts";
import { detectGitHeadFileChanges, detectIndexFileChanges, detectIndexFreshness, summarizeFileChanges } from "../freshness.ts";
import { exists, readConfig, readRepoScopeControl } from "../fs.ts";
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
  let extractionSummary = {
    parsed: 0,
    recovered: 0,
    fallback: 0,
    byLanguage: [] as Array<{
      language: string;
      total: number;
      parsed: number;
      recovered: number;
      fallback: number;
    }>
  };
  let indexedSchemaVersion: number | null = null;
  let indexedIndexFormatVersion: number | null = null;
  let indexedScopeSignature: string | null = null;
  let languages = config?.languages ?? defaultLanguages();
  const scopeControl = await readRepoScopeControl(root);
  let freshness = {
    stale: false,
    changedFiles: 0,
    newFiles: 0,
    deletedFiles: 0,
    scopeChanged: false
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
  let graphAwareness = {
    likelyRoots: [] as Array<{
      path: string;
      language: string;
      reasons: string[];
    }>,
    possibleOrphans: [] as Array<{
      id: number;
      path: string;
      language: string;
      kind: string;
      name: string;
      reasons: string[];
    }>
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
  let indexCompatibility = {
    currentIndexFormatVersion: CURRENT_INDEX_FORMAT_VERSION,
    indexedIndexFormatVersion: null as number | null,
    requiresRebuild: false
  };
  let impactTracking = {
    enabled: Boolean(config?.impactTracking?.enabled),
    storesRawQueryText: false,
    storage: "repo_local_metadata",
    summary: null as ReturnType<typeof getImpactTrackingSummary> | null
  };

  if (dbExists) {
    const db = await openDatabase(root);
    const summary = getStatusSummary(db);
    indexCompatibility = getIndexCompatibility(db);
    const indexedRows = getIndexedFiles(db);
    const symbolChanges = getLatestSymbolChangeSummary(db);
    graphAwareness = {
      likelyRoots: getLikelyGraphRoots(db),
      possibleOrphans: getPossibleOrphanCandidates(db)
    };
    embeddings = summarizeEmbeddingSupport(db, config);
    indexedFileCount = summary.indexedFiles;
    indexedSymbols = summary.indexedSymbols;
    fallbackSymbols = summary.fallbackSymbols;
    extractionSummary = summary.extractionSummary;
    indexedSchemaVersion = summary.schemaVersion;
    indexedIndexFormatVersion = summary.indexFormatVersion;
    indexedScopeSignature = summary.indexScopeSignature;
    if (summary.languages.length > 0) {
      languages = summary.languages;
    }
    freshness = await detectIndexFreshness(root, indexedRows, {
      indexedScopeSignature
    });
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
    if (config?.impactTracking?.enabled) {
      const partialPayload = {
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
        currentIndexFormatVersion: CURRENT_INDEX_FORMAT_VERSION,
        indexedIndexFormatVersion,
        indexCompatibility,
        scopeControl: {
          path: scopeControl.path,
          exists: scopeControl.exists,
          ruleCount: scopeControl.rules.length,
          rules: scopeControl.rules,
          indexedScopeSignature,
          currentScopeSignature: scopeControl.signature
        },
        indexedFiles: indexedFileCount,
        indexedSymbols,
        fallbackSymbols,
        extractionSummary,
        setupType: config?.setupType ?? null,
        shellGuidance,
        embeddings,
        indexFreshness: freshness,
        changeAwareness,
        graphAwareness
      };
      impactTracking.summary = recordImpactTrackingEvent(db, {
        command: "status",
        timestamp: new Date().toISOString(),
        payloadChars: JSON.stringify(partialPayload).length,
        compact: false,
        staleIndex: freshness.stale
      });
    } else {
      impactTracking.summary = getImpactTrackingSummary(db);
    }
    db.close();
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
    currentIndexFormatVersion: CURRENT_INDEX_FORMAT_VERSION,
    indexedIndexFormatVersion,
    indexCompatibility,
    scopeControl: {
      path: scopeControl.path,
      exists: scopeControl.exists,
      ruleCount: scopeControl.rules.length,
      rules: scopeControl.rules,
      indexedScopeSignature,
      currentScopeSignature: scopeControl.signature
    },
    indexedFiles: indexedFileCount,
    indexedSymbols,
    fallbackSymbols,
    extractionSummary,
    setupType: config?.setupType ?? null,
    shellGuidance,
    embeddings,
    indexFreshness: freshness,
    changeAwareness,
    graphAwareness,
    impactTracking
  }, null, 2));
}
