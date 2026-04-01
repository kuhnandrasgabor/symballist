import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { appPath, DB_FILE } from "./config.ts";
import type {
  ExtractionKind,
  GraphDiagnostics,
  GraphSignal,
  GraphTraversalEntry,
  GraphTraversalKind,
  HybridContribution,
  ImpactCommandName,
  ImpactTrackingSummary,
  ImpactTransitionName,
  MatchReason,
  QueryResult,
  RetrievalChannel,
  RetrievalQualityLevel,
  RelatedSymbol,
  RelationDetails,
  ResultConfidence,
  SearchDiagnostics,
  SymbolDetails,
  SymbolLookupOptions,
  QueryIntentOptions,
  SymbolRecord,
  TrustLevel
} from "./types.ts";
import { isOversizedRecoveryDoc } from "./indexer/oversized.ts";

export const CURRENT_SCHEMA_VERSION = 6;
export const CURRENT_INDEX_FORMAT_VERSION = 2;

const SYMBOL_CHANGE_SUMMARY_KEY = "latest_symbol_change_summary";
const INDEX_FORMAT_VERSION_KEY = "index_format_version";
const INDEX_SCOPE_SIGNATURE_KEY = "index_scope_signature";
const IMPACT_SUMMARY_KEY = "impact_tracking_summary";
const IMPACT_LAST_EVENT_KEY = "impact_tracking_last_event";
const IMPACT_LAST_FLOW_EVENT_KEY = "impact_tracking_last_flow_event";
const MAX_SYMBOL_CHANGE_SAMPLES = 20;
const IMPACT_SEQUENCE_WINDOW_MS = 30 * 60 * 1000;
export const CURRENT_EMBEDDING_PROVIDER = "ollama";

export type IndexedFileRow = {
  path: string;
  language: string;
  size: number;
  mtimeMs: number;
};

export type StatusSummary = {
  indexedFiles: number;
  indexedSymbols: number;
  fallbackSymbols: number;
  languages: string[];
  schemaVersion: number;
  indexFormatVersion: number;
  indexScopeSignature: string | null;
};

export type IndexCompatibility = {
  currentIndexFormatVersion: number;
  indexedIndexFormatVersion: number | null;
  requiresRebuild: boolean;
};

export type EmbeddingSummary = {
  totalEmbeddings: number;
  matchingEmbeddings: number;
};

export type EmbeddableSymbolRow = {
  id: number;
  path: string;
  language: SymbolRecord["language"];
  kind: string;
  name: string;
  signature: string | null;
  doc: string | null;
  body: string;
};

type SearchRow = {
  id: number;
  path: string;
  language: SymbolRecord["language"];
  kind: string;
  name: string;
  signature: string | null;
  doc: string | null;
  body: string;
  fallback: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  rawScore: number;
  semanticSimilarity: number | null;
  lexicalCandidate: boolean;
  conceptCandidate: boolean;
  semanticCandidate: boolean;
  lexicalRank: number | null;
  conceptRank: number | null;
  semanticRank: number | null;
};
type SymbolDetailsRow = Omit<SymbolDetails, "fallback" | "file" | "location" | "extraction" | "trustLevel"> & { fallback: number };
type RelationRow = {
  kind: RelationDetails["kind"];
  targetPath: string | null;
  targetLabel: string;
};
type InboundRelationRow = RelationRow & {
  sourcePath: string;
};
type SearchOptions = {
  kinds?: string[];
  rawQuery?: string;
  embeddingProvider?: "ollama" | null;
  embeddingModel?: string | null;
  queryEmbedding?: number[] | null;
} & QueryIntentOptions;
type ExtractionDetails = {
  extraction: ExtractionKind;
  trustLevel: TrustLevel;
};
type MatchAnalysis = {
  adjustment: number;
  reason: MatchReason;
  confidence: ResultConfidence;
};

type QueryTrustDetails = {
  retrievalTrustLevel: TrustLevel;
};
type RankedQueryResult = QueryResult & {
  rawScore: number;
  adjustedScore: number;
};
type SearchExecution = {
  results: QueryResult[];
  diagnostics: SearchDiagnostics;
};
type GraphSupport = {
  adjustment: number;
  signals: GraphSignal[];
};

type GraphDiagnosticContext = {
  id: number;
  path: string;
  language: SymbolRecord["language"];
  name: string;
};

type StoredSymbolChangeSummary = {
  addedCount: number;
  removedCount: number;
  changedCount: number;
  added: SymbolChangeSample[];
  removed: SymbolChangeSample[];
  changed: SymbolChangeSample[];
};

export type SymbolChangeSample = {
  path: string;
  kind: string;
  name: string;
};

export type SymbolChangeSummary = StoredSymbolChangeSummary & {
  truncated: boolean;
};

export type GraphRootCandidate = {
  path: string;
  language: SymbolRecord["language"];
  reasons: string[];
};

export type PossibleOrphanCandidate = {
  id: number;
  path: string;
  language: SymbolRecord["language"];
  kind: string;
  name: string;
  reasons: string[];
};

type RootHeuristicInput = {
  path: string;
  language: SymbolRecord["language"];
  topLevelNames: string[];
};

type StoredImpactSummary = Omit<ImpactTrackingSummary, "lastCommand"> & {
  lastCommand: {
    command: ImpactCommandName;
    timestamp: string;
  } | null;
};

type ImpactTrackingEvent = {
  command: ImpactCommandName;
  timestamp: string;
  payloadChars: number;
  compact: boolean;
  retrievalMode?: "lexical" | "hybrid";
  resultQualityLevel?: RetrievalQualityLevel;
  noStrongMatch?: boolean;
  selectedResult?: boolean;
  bodyMode?: "summary" | "full";
  fullRequested?: boolean;
  graphEdgesViewed?: number;
  staleIndex?: boolean;
};

const KIND_SCORE_ADJUSTMENTS = new Map<string, number>([
  ["class", -1.1],
  ["function", -1.0],
  ["heading", -0.8],
  ["title", -0.75],
  ["element", -0.5],
  ["import", 0.75],
  ["file", 1.0]
]);
const DOC_ORIENTED_QUERY_TERMS = new Set([
  "architecture",
  "backlog",
  "design",
  "decision",
  "doc",
  "docs",
  "guide",
  "notes",
  "plan",
  "readme",
  "roadmap",
  "workflow"
]);
const CONCEPTUAL_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "do",
  "does",
  "for",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "work",
  "works"
]);

const SEMANTIC_EXACT_THRESHOLD = 0.9;
const SEMANTIC_STRONG_THRESHOLD = 0.75;
const SEMANTIC_RELATED_THRESHOLD = 0.6;

export async function openDatabase(root: string): Promise<Database> {
  const path = appPath(root, DB_FILE);
  await mkdir(dirname(path), { recursive: true });

  let db: Database;
  try {
    db = new Database(path);
  } catch (error) {
    throw wrapDatabaseError(error, path);
  }

  try {
    migrate(db);
    return db;
  } catch (error) {
    db.close(false);
    throw wrapDatabaseError(error, path);
  }
}

function wrapDatabaseError(error: unknown, path: string): Error {
  if (error instanceof Error && "code" in error && error.code === "SQLITE_READONLY") {
    return new Error(`Database at ${path} is not writable. Delete the existing .symballist directory or index.db and rerun init/index from your normal local shell.`);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      language TEXT NOT NULL,
      size INTEGER NOT NULL,
      mtime_ms REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      language TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      signature TEXT,
      body TEXT NOT NULL,
      doc TEXT,
      fallback INTEGER NOT NULL DEFAULT 0,
      start_line INTEGER NOT NULL DEFAULT 1,
      start_column INTEGER NOT NULL DEFAULT 1,
      end_line INTEGER NOT NULL DEFAULT 1,
      end_column INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_symbol_id INTEGER,
      source_path TEXT NOT NULL,
      relation_kind TEXT NOT NULL,
      target_path TEXT,
      target_label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS symbol_embeddings (
      symbol_id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      embedding_json TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
      symbol_id UNINDEXED,
      path,
      name,
      kind,
      signature,
      body,
      doc,
      language,
      content
    );

    CREATE INDEX IF NOT EXISTS idx_relations_target_kind_source
      ON relations (target_path, relation_kind, source_path);
    CREATE INDEX IF NOT EXISTS idx_relations_source_symbol_kind_target
      ON relations (source_symbol_id, relation_kind, target_path);
    CREATE INDEX IF NOT EXISTS idx_relations_source_path_kind_target
      ON relations (source_path, relation_kind, target_path);
  `);

  ensureColumn(db, "symbols", "start_line", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "symbols", "start_column", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "symbols", "end_line", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "symbols", "end_column", "INTEGER NOT NULL DEFAULT 1");

  const schemaVersion = getSchemaVersion(db);
  if (schemaVersion < CURRENT_SCHEMA_VERSION) {
    clearIndexData(db);
    setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
    setIndexFormatVersion(db, CURRENT_INDEX_FORMAT_VERSION);
    return;
  }

  if (getIndexFormatVersion(db) === null) {
    setIndexFormatVersion(db, 0);
  }
}

function ensureColumn(db: Database, tableName: string, columnName: string, definition: string): boolean {
  const columns = db.query(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return false;
  }
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  return true;
}

function getSchemaVersion(db: Database): number {
  const row = db.query("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value?: string } | null;
  return Number(row?.value ?? 0) || 0;
}

function setSchemaVersion(db: Database, version: number): void {
  db.query(`
    INSERT INTO metadata (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(version));
}

function getIndexFormatVersion(db: Database): number | null {
  const row = db.query("SELECT value FROM metadata WHERE key = ?").get(INDEX_FORMAT_VERSION_KEY) as { value?: string } | null;
  if (!row?.value) {
    return null;
  }
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function setIndexFormatVersion(db: Database, version: number): void {
  db.query(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(INDEX_FORMAT_VERSION_KEY, String(version));
}

export function getIndexedScopeSignature(db: Database): string | null {
  const row = db.query("SELECT value FROM metadata WHERE key = ?").get(INDEX_SCOPE_SIGNATURE_KEY) as { value?: string } | null;
  return row?.value ?? null;
}

export function setIndexedScopeSignature(db: Database, signature: string): void {
  db.query(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(INDEX_SCOPE_SIGNATURE_KEY, signature);
}

export function getIndexCompatibility(db: Database): IndexCompatibility {
  const indexedIndexFormatVersion = getIndexFormatVersion(db);
  return {
    currentIndexFormatVersion: CURRENT_INDEX_FORMAT_VERSION,
    indexedIndexFormatVersion,
    requiresRebuild: indexedIndexFormatVersion !== CURRENT_INDEX_FORMAT_VERSION
  };
}

export function rebuildStoredIndex(db: Database): void {
  clearIndexData(db);
  resetLatestSymbolChangeSummary(db);
  setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
  setIndexFormatVersion(db, CURRENT_INDEX_FORMAT_VERSION);
}

export function markCurrentIndexFormat(db: Database): void {
  setIndexFormatVersion(db, CURRENT_INDEX_FORMAT_VERSION);
}

function defaultSymbolChangeSummary(): StoredSymbolChangeSummary {
  return {
    addedCount: 0,
    removedCount: 0,
    changedCount: 0,
    added: [],
    removed: [],
    changed: []
  };
}

function readStoredSymbolChangeSummary(db: Database): StoredSymbolChangeSummary {
  const row = db.query("SELECT value FROM metadata WHERE key = ?").get(SYMBOL_CHANGE_SUMMARY_KEY) as { value?: string } | null;
  if (!row?.value) {
    return defaultSymbolChangeSummary();
  }

  try {
    const parsed = JSON.parse(row.value) as Partial<StoredSymbolChangeSummary>;
    return {
      addedCount: Number(parsed.addedCount ?? 0) || 0,
      removedCount: Number(parsed.removedCount ?? 0) || 0,
      changedCount: Number(parsed.changedCount ?? 0) || 0,
      added: Array.isArray(parsed.added) ? parsed.added.filter(Boolean).slice(0, MAX_SYMBOL_CHANGE_SAMPLES) as SymbolChangeSample[] : [],
      removed: Array.isArray(parsed.removed) ? parsed.removed.filter(Boolean).slice(0, MAX_SYMBOL_CHANGE_SAMPLES) as SymbolChangeSample[] : [],
      changed: Array.isArray(parsed.changed) ? parsed.changed.filter(Boolean).slice(0, MAX_SYMBOL_CHANGE_SAMPLES) as SymbolChangeSample[] : []
    };
  } catch {
    return defaultSymbolChangeSummary();
  }
}

function writeStoredSymbolChangeSummary(db: Database, summary: StoredSymbolChangeSummary): void {
  db.query(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(SYMBOL_CHANGE_SUMMARY_KEY, JSON.stringify(summary));
}

function defaultImpactTrackingSummary(): StoredImpactSummary {
  return {
    recordedCommands: 0,
    recordedInfrastructureCommands: 0,
    commandCounts: {
      status: 0,
      index: 0,
      watch: 0,
      lookup: 0,
      query: 0,
      show: 0,
      graph: 0,
      report: 0
    },
    infrastructureCommandCounts: {
      watch: 0
    },
    retrievalModeCounts: {
      lexical: 0,
      hybrid: 0
    },
    resultQualityCounts: {
      strong: 0,
      moderate: 0,
      weak: 0,
      none: 0
    },
    bodyModeCounts: {
      summary: 0,
      full: 0
    },
    transitionCounts: {
      lookup_to_show: 0,
      query_to_show: 0,
      lookup_to_graph: 0,
      query_to_graph: 0,
      weak_result_retry: 0,
      lookup_to_full_show: 0,
      lookup_to_full_graph: 0
    },
    workflowSignals: {
      oneShotStrongLookups: 0,
      noStrongMatchCount: 0,
      fullBodyExpansions: 0,
      graphFollowUpsAfterRetrieval: 0
    },
    payloadCharsReturned: 0,
    estimatedImpact: {
      avoidedSearchLoops: 0,
      avoidedDirectFileReads: 0
    },
    lastCommand: null,
    lastInfrastructureCommand: null
  };
}

function readStoredImpactSummary(db: Database): StoredImpactSummary {
  const row = db.query("SELECT value FROM metadata WHERE key = ?").get(IMPACT_SUMMARY_KEY) as { value?: string } | null;
  if (!row?.value) {
    return defaultImpactTrackingSummary();
  }

  try {
    const parsed = JSON.parse(row.value) as Partial<StoredImpactSummary>;
    const base = defaultImpactTrackingSummary();
    return {
      ...base,
      ...parsed,
      commandCounts: {
        ...base.commandCounts,
        ...(parsed.commandCounts ?? {})
      },
      infrastructureCommandCounts: {
        ...base.infrastructureCommandCounts,
        ...(parsed.infrastructureCommandCounts ?? {})
      },
      retrievalModeCounts: {
        ...base.retrievalModeCounts,
        ...(parsed.retrievalModeCounts ?? {})
      },
      resultQualityCounts: {
        ...base.resultQualityCounts,
        ...(parsed.resultQualityCounts ?? {})
      },
      bodyModeCounts: {
        ...base.bodyModeCounts,
        ...(parsed.bodyModeCounts ?? {})
      },
      transitionCounts: {
        ...base.transitionCounts,
        ...(parsed.transitionCounts ?? {})
      },
      workflowSignals: {
        ...base.workflowSignals,
        ...(parsed.workflowSignals ?? {})
      },
      estimatedImpact: {
        ...base.estimatedImpact,
        ...(parsed.estimatedImpact ?? {})
      },
      lastCommand: parsed.lastCommand?.command && parsed.lastCommand?.timestamp
        ? {
            command: parsed.lastCommand.command,
            timestamp: parsed.lastCommand.timestamp
          }
        : null,
      lastInfrastructureCommand: parsed.lastInfrastructureCommand?.command === "watch" && parsed.lastInfrastructureCommand?.timestamp
        ? {
            command: "watch",
            timestamp: parsed.lastInfrastructureCommand.timestamp
          }
        : null
    };
  } catch {
    return defaultImpactTrackingSummary();
  }
}

function writeStoredImpactSummary(db: Database, summary: StoredImpactSummary): void {
  db.query(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(IMPACT_SUMMARY_KEY, JSON.stringify(summary));
}

function readLastImpactEvent(db: Database): ImpactTrackingEvent | null {
  const row = db.query("SELECT value FROM metadata WHERE key = ?").get(IMPACT_LAST_EVENT_KEY) as { value?: string } | null;
  if (!row?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.value) as ImpactTrackingEvent;
    if (!parsed?.command || !parsed?.timestamp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLastImpactEvent(db: Database, event: ImpactTrackingEvent): void {
  db.query(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(IMPACT_LAST_EVENT_KEY, JSON.stringify(event));
}

function readLastImpactFlowEvent(db: Database): ImpactTrackingEvent | null {
  const row = db.query("SELECT value FROM metadata WHERE key = ?").get(IMPACT_LAST_FLOW_EVENT_KEY) as { value?: string } | null;
  if (!row?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.value) as ImpactTrackingEvent;
    if (!parsed?.command || !parsed?.timestamp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLastImpactFlowEvent(db: Database, event: ImpactTrackingEvent): void {
  db.query(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(IMPACT_LAST_FLOW_EVENT_KEY, JSON.stringify(event));
}

function isFlowTrackingCommand(command: ImpactCommandName): boolean {
  return command === "lookup" || command === "query" || command === "show" || command === "graph";
}

function updateTransitionCounts(
  summary: StoredImpactSummary,
  previous: ImpactTrackingEvent | null,
  current: ImpactTrackingEvent
): void {
  if (!previous) {
    return;
  }

  const previousTime = Date.parse(previous.timestamp);
  const currentTime = Date.parse(current.timestamp);
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime) || currentTime < previousTime) {
    return;
  }
  if (currentTime - previousTime > IMPACT_SEQUENCE_WINDOW_MS) {
    return;
  }

  if (previous.command === "lookup" && current.command === "show") {
    summary.transitionCounts.lookup_to_show += 1;
    if (current.bodyMode === "full" || current.fullRequested === true) {
      summary.transitionCounts.lookup_to_full_show += 1;
    }
  }
  if (previous.command === "query" && current.command === "show") {
    summary.transitionCounts.query_to_show += 1;
  }
  if (previous.command === "lookup" && current.command === "graph") {
    summary.transitionCounts.lookup_to_graph += 1;
    summary.workflowSignals.graphFollowUpsAfterRetrieval += 1;
    summary.estimatedImpact.avoidedSearchLoops += 1;
    if (current.fullRequested === true) {
      summary.transitionCounts.lookup_to_full_graph += 1;
    }
  }
  if (previous.command === "query" && current.command === "graph") {
    summary.transitionCounts.query_to_graph += 1;
    summary.workflowSignals.graphFollowUpsAfterRetrieval += 1;
    summary.estimatedImpact.avoidedSearchLoops += 1;
  }
  if ((previous.command === "query" || previous.command === "lookup")
    && (current.command === "query" || current.command === "lookup")
    && previous.noStrongMatch === true) {
    summary.transitionCounts.weak_result_retry += 1;
  }
}

export function getImpactTrackingSummary(db: Database): ImpactTrackingSummary {
  return readStoredImpactSummary(db);
}

export function recordImpactTrackingEvent(db: Database, event: ImpactTrackingEvent): ImpactTrackingSummary {
  const summary = readStoredImpactSummary(db);
  const previous = isFlowTrackingCommand(event.command)
    ? readLastImpactFlowEvent(db)
    : readLastImpactEvent(db);

  if (event.command === "watch") {
    summary.recordedInfrastructureCommands += 1;
    summary.infrastructureCommandCounts.watch += 1;
    summary.lastInfrastructureCommand = {
      command: "watch",
      timestamp: event.timestamp
    };
    writeStoredImpactSummary(db, summary);
    writeLastImpactEvent(db, event);
    return summary;
  }

  summary.recordedCommands += 1;
  summary.commandCounts[event.command] += 1;
  summary.payloadCharsReturned += Math.max(0, event.payloadChars);

  if (event.retrievalMode) {
    summary.retrievalModeCounts[event.retrievalMode] += 1;
  }
  if (event.resultQualityLevel) {
    summary.resultQualityCounts[event.resultQualityLevel] += 1;
  }
  if (event.bodyMode) {
    summary.bodyModeCounts[event.bodyMode] += 1;
    summary.estimatedImpact.avoidedDirectFileReads += 1;
    if (event.bodyMode === "full") {
      summary.workflowSignals.fullBodyExpansions += 1;
    }
  }
  if (event.command === "lookup" && event.resultQualityLevel === "strong" && event.selectedResult) {
    summary.workflowSignals.oneShotStrongLookups += 1;
    summary.estimatedImpact.avoidedSearchLoops += 1;
  }
  if (event.command === "query" && (event.resultQualityLevel === "strong" || event.resultQualityLevel === "moderate")) {
    summary.estimatedImpact.avoidedSearchLoops += 1;
  }
  if (event.noStrongMatch === true) {
    summary.workflowSignals.noStrongMatchCount += 1;
  }

  updateTransitionCounts(summary, previous, event);

  summary.lastCommand = {
    command: event.command,
    timestamp: event.timestamp
  };

  writeStoredImpactSummary(db, summary);
  writeLastImpactEvent(db, event);
  if (isFlowTrackingCommand(event.command)) {
    writeLastImpactFlowEvent(db, event);
  }
  return summary;
}

function clearIndexData(db: Database): void {
  db.exec(`
    DELETE FROM symbols_fts;
    DELETE FROM symbol_embeddings;
    DELETE FROM relations;
    DELETE FROM symbols;
    DELETE FROM files;
  `);
}

function makeSnippet(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= 200) {
    return normalized;
  }
  return `${normalized.slice(0, 197).trimEnd()}...`;
}

function normalizeLookupValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function unwrapQuotedLookupValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "\"" && last === "\"")
    || (first === "'" && last === "'")
    || (first === "`" && last === "`")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function lookupLiteralVariants(rawValue: string): string[] {
  const variants = new Set<string>();
  const trimmed = rawValue.trim();
  const unwrapped = unwrapQuotedLookupValue(rawValue);

  if (trimmed) {
    variants.add(trimmed);
  }
  if (unwrapped) {
    variants.add(unwrapped);
  }

  return [...variants];
}

function normalizedLookupSql(column: string): string {
  return `replace(replace(replace(replace(replace(replace(lower(${column}), '\\\\', ''), '/', ''), '-', ''), ' ', ''), '.', ''), ':', '')`;
}

function extractFtsTerms(value: string): string[] {
  return value.match(/[A-Za-z0-9_]+/g) ?? [];
}

function tokenizeLookupTerms(value: string): string[] {
  return value
    .split(/[^A-Za-z0-9]+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function conceptualTerms(value: string): string[] {
  return tokenizeLookupTerms(value).filter((term) => !CONCEPTUAL_STOPWORDS.has(term));
}

type TypedQueryIntent = {
  parameterTerms: string[];
  returnTerms: string[];
};

function normalizeConceptTerm(term: string): string {
  let normalized = term.trim().toLowerCase();
  if (!normalized) {
    return normalized;
  }

  if (normalized.endsWith("ies") && normalized.length > 4) {
    normalized = `${normalized.slice(0, -3)}y`;
  } else if (normalized.endsWith("ing") && normalized.length > 5) {
    normalized = normalized.slice(0, -3);
  } else if (normalized.endsWith("s") && !normalized.endsWith("ss") && normalized.length > 3) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function normalizeConceptTerms(terms: string[]): string[] {
  const normalized = terms
    .map((term) => normalizeConceptTerm(term))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function countNormalizedConceptMatches(queryTerms: string[], ...candidateTermGroups: string[][]): number {
  const candidateTerms = new Set(
    candidateTermGroups.flatMap((group) => normalizeConceptTerms(group))
  );
  return normalizeConceptTerms(queryTerms).filter((term) => candidateTerms.has(term)).length;
}

function extractTypedQueryIntent(rawQuery: string): TypedQueryIntent {
  const conceptual = conceptualTerms(rawQuery);
  if (conceptual.length === 0) {
    return { parameterTerms: [], returnTerms: [] };
  }

  const parameterHintTerms = new Set(["accept", "accepts", "take", "takes", "parameter", "parameters", "argument", "arguments"]);
  const returnHintTerms = new Set(["return", "returns", "yield", "yields", "output", "outputs"]);

  const parameterTerms = conceptual.filter((term) => !parameterHintTerms.has(term) && !returnHintTerms.has(term));
  const returnTerms = conceptual.filter((term) => !parameterHintTerms.has(term) && !returnHintTerms.has(term));

  return {
    parameterTerms: conceptual.some((term) => parameterHintTerms.has(term)) ? parameterTerms : [],
    returnTerms: conceptual.some((term) => returnHintTerms.has(term)) ? returnTerms : []
  };
}

function isTypedLanguage(language: SearchRow["language"]): boolean {
  return language === "python" || language === "typescript";
}

function splitCamelCase(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function getExtractionDetails(row: { fallback: number | boolean; doc: string | null }): ExtractionDetails {
  if (Boolean(row.fallback)) {
    return {
      extraction: "fallback",
      trustLevel: "low"
    };
  }

  if (isOversizedRecoveryDoc(row.doc)) {
    return {
      extraction: "recovered",
      trustLevel: "medium"
    };
  }

  return {
    extraction: "parsed",
    trustLevel: "high"
  };
}

function getQueryTrustDetails(extraction: ExtractionDetails, confidence: ResultConfidence): QueryTrustDetails {
  if (extraction.extraction === "fallback" || confidence === "fallback") {
    return {
      retrievalTrustLevel: "low"
    };
  }

  if (confidence === "exact") {
    return {
      retrievalTrustLevel: "high"
    };
  }

  if (confidence === "strong") {
    return {
      retrievalTrustLevel: extraction.extraction === "parsed" ? "high" : "medium"
    };
  }

  return {
    retrievalTrustLevel: extraction.extraction === "parsed" ? "medium" : "low"
  };
}

function buildFileReference(path: string, language: SymbolRecord["language"]): QueryResult["file"] {
  return {
    path,
    language
  };
}

function buildLocation(
  path: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): QueryResult["location"] {
  return {
    path,
    startLine,
    startColumn,
    endLine,
    endColumn
  };
}

function isSymbolShapedQuery(rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }

  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)
    && (/[A-Z]/.test(trimmed) || trimmed.includes("_"));
}

function isDefinitionLikeKind(kind: string): boolean {
  return kind === "class" || kind === "function" || kind === "title" || kind === "element" || kind === "heading";
}

function analyzeConceptPathMatch(row: SearchRow, rawQuery: string): MatchAnalysis | null {
  if (row.language === "markdown" || row.kind === "import" || row.kind === "file" || isTestPath(row.path)) {
    return null;
  }

  const queryTerms = conceptualTerms(rawQuery);
  if (queryTerms.length === 0 || isDocOrientedQuery(rawQuery)) {
    return null;
  }

  const normalizedQuery = normalizeLookupValue(rawQuery);
  if (!normalizedQuery) {
    return null;
  }

  const normalizedPath = row.path.toLowerCase().replace(/\\/g, "/");
  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;
  const stem = fileName.replace(/\.[^.]+$/, "");
  const stemNormalized = normalizeLookupValue(stem);
  const stemTerms = splitCamelCase(stem);
  const pathTerms = splitCamelCase(normalizedPath);
  const matchesAllTerms = queryTerms.every((term) => pathTerms.includes(term));
  const definitionBias = isDefinitionLikeKind(row.kind) ? -1.2 : 0;
  const topLevelBias = row.startLine <= 120 ? -0.4 : 0;

  if (stemNormalized === normalizedQuery) {
    return {
      adjustment: -3.25 + definitionBias + topLevelBias,
      reason: "path_concept",
      confidence: "strong"
    };
  }

  const sameTermSet = queryTerms.length > 1
    && queryTerms.length === stemTerms.length
    && queryTerms.every((term) => stemTerms.includes(term));
  if (sameTermSet) {
    return {
      adjustment: -2.75 + definitionBias + topLevelBias,
      reason: "path_concept",
      confidence: "strong"
    };
  }

  if (queryTerms.length > 1 && matchesAllTerms && isDefinitionLikeKind(row.kind)) {
    return {
      adjustment: -1.15 + topLevelBias,
      reason: "path_concept",
      confidence: "related"
    };
  }

  return null;
}

export function buildFtsQuery(rawQuery: string): string {
  const terms = extractFtsTerms(rawQuery).map((term) => term.replace(/"/g, ""));

  if (terms.length === 0) {
    return normalizeLookupValue(rawQuery);
  }

  const clauses = new Set(terms);
  if (terms.length > 1) {
    const combined = normalizeLookupValue(rawQuery);
    if (combined) {
      clauses.add(combined);
    }
  }

  return clauses.size > 1 ? [...clauses].join(" OR ") : [...clauses][0] ?? rawQuery.trim();
}

function getExactLookupCandidates(
  db: Database,
  rawQuery: string,
  kinds: string[],
  limit: number
): SearchRow[] {
  const variants = lookupLiteralVariants(rawQuery);
  if (variants.length === 0) {
    return [];
  }
  const normalizedVariants = [...new Set(variants.map((variant) => normalizeLookupValue(variant)).filter(Boolean))];

  const kindClause = kinds.length > 0
    ? ` AND kind IN (${kinds.map(() => "?").join(", ")})`
    : "";
  const exactPlaceholders = variants.map(() => "?").join(", ");
  const normalizedPlaceholders = normalizedVariants.map(() => "?").join(", ");
  const exactNameClause = `lower(name) IN (${exactPlaceholders})`;
  const exactSignatureClause = `lower(COALESCE(signature, '')) IN (${exactPlaceholders})`;
  const exactPathClause = `lower(path) IN (${exactPlaceholders})`;
  const normalizedSignatureSuffixClause = normalizedVariants.length > 0
    ? ` OR ${normalizedLookupSql("COALESCE(signature, '')")} LIKE '%' || ?`
    : "";
  const normalizedClause = normalizedVariants.length > 0
    ? `
      OR ${normalizedLookupSql("name")} IN (${normalizedPlaceholders})
      OR ${normalizedLookupSql("COALESCE(signature, '')")} IN (${normalizedPlaceholders})
      OR ${normalizedLookupSql("path")} IN (${normalizedPlaceholders})
      ${normalizedSignatureSuffixClause}
    `
    : "";
  const exactValues = variants.map((variant) => variant.toLowerCase());

  const rows = db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      doc,
      body,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn,
      0.0 AS rawScore,
      NULL AS semanticSimilarity
    FROM symbols
    WHERE (
      ${exactNameClause}
      OR ${exactSignatureClause}
      OR ${exactPathClause}
      ${normalizedClause}
    )
    ${kindClause}
    ORDER BY
      CASE
        WHEN ${exactNameClause} THEN 0
        WHEN ${exactSignatureClause} THEN 1
        WHEN ${exactPathClause} THEN 2
        ${normalizedVariants.length > 0 ? `WHEN ${normalizedLookupSql("name")} IN (${normalizedPlaceholders}) THEN 3
        WHEN ${normalizedLookupSql("COALESCE(signature, '')")} IN (${normalizedPlaceholders}) THEN 4
        WHEN ${normalizedLookupSql("path")} IN (${normalizedPlaceholders}) THEN 5
        WHEN ${normalizedLookupSql("COALESCE(signature, '')")} LIKE '%' || ? THEN 6` : ""}
        ELSE 7
      END,
      CASE kind
        WHEN 'class' THEN 0
        WHEN 'function' THEN 1
        WHEN 'selector' THEN 2
        WHEN 'key' THEN 3
        WHEN 'stage' THEN 4
        WHEN 'file' THEN 5
        ELSE 6
      END,
      start_line ASC,
      id ASC
    LIMIT ?
  `).all(
    ...exactValues,
    ...exactValues,
    ...exactValues,
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? [normalizedVariants[0]!] : []),
    ...kinds,
    ...exactValues,
    ...exactValues,
    ...exactValues,
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? [normalizedVariants[0]!] : []),
    limit
  ) as SearchRow[];

  return rows.map((row) => ({
    ...row,
    rawScore: syntheticExactLookupRawScore(row, variants[0] ?? rawQuery.trim()),
    lexicalCandidate: true,
    conceptCandidate: false,
    semanticCandidate: false,
    lexicalRank: null,
    conceptRank: null,
    semanticRank: null
  }));
}

function getLiteralFallbackCandidates(
  db: Database,
  rawQuery: string,
  kinds: string[],
  limit: number
): SearchRow[] {
  const trimmedQuery = rawQuery.trim();
  const normalizedQuery = normalizeLookupValue(rawQuery);
  if (!trimmedQuery && !normalizedQuery) {
    return [];
  }

  const loweredRawQuery = trimmedQuery.toLowerCase();
  const likeRaw = loweredRawQuery ? `%${loweredRawQuery}%` : "";
  const likeNormalized = normalizedQuery ? `%${normalizedQuery}%` : "";
  const kindClause = kinds.length > 0
    ? ` AND kind IN (${kinds.map(() => "?").join(", ")})`
    : "";

  const rows = db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      doc,
      body,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn,
      0.0 AS rawScore,
      NULL AS semanticSimilarity
    FROM symbols
    WHERE (
      lower(path) LIKE ?
      OR lower(name) LIKE ?
      OR lower(COALESCE(signature, '')) LIKE ?
      OR lower(COALESCE(doc, '')) LIKE ?
      OR lower(body) LIKE ?
      OR replace(replace(replace(replace(lower(path), '\\', ''), '/', ''), '-', ''), ' ', '') LIKE ?
      OR replace(replace(replace(replace(lower(name), '\\', ''), '/', ''), '-', ''), ' ', '') LIKE ?
      OR replace(replace(replace(replace(lower(COALESCE(signature, '')), '\\', ''), '/', ''), '-', ''), ' ', '') LIKE ?
      OR replace(replace(replace(replace(lower(COALESCE(doc, '')), '\\', ''), '/', ''), '-', ''), ' ', '') LIKE ?
      OR replace(replace(replace(replace(lower(body), '\\', ''), '/', ''), '-', ''), ' ', '') LIKE ?
    )
    ${kindClause}
    ORDER BY
      CASE
        WHEN lower(name) = ? THEN 0
        WHEN lower(COALESCE(signature, '')) LIKE ? THEN 1
        WHEN lower(body) LIKE ? THEN 2
        ELSE 3
      END,
      CASE kind
        WHEN 'class' THEN 0
        WHEN 'function' THEN 1
        WHEN 'heading' THEN 2
        ELSE 3
      END,
      start_line ASC,
      id ASC
    LIMIT ?
  `).all(
    likeRaw,
    likeRaw,
    likeRaw,
    likeRaw,
    likeRaw,
    likeNormalized,
    likeNormalized,
    likeNormalized,
    likeNormalized,
    likeNormalized,
    ...kinds,
    loweredRawQuery,
    likeRaw,
    likeRaw,
    limit
  ) as SearchRow[];

  return rows.map((row) => ({
    ...row,
    rawScore: syntheticLiteralRawScore(row, trimmedQuery, normalizedQuery),
    lexicalCandidate: true,
    conceptCandidate: false,
    semanticCandidate: false,
    lexicalRank: null,
    conceptRank: null,
    semanticRank: null
  }));
}

function syntheticExactLookupRawScore(row: SearchRow, rawQuery: string): number {
  const loweredRawQuery = rawQuery.toLowerCase();
  if (row.name.trim().toLowerCase() === loweredRawQuery) {
    return -7.5;
  }
  if ((row.signature ?? "").trim().toLowerCase() === loweredRawQuery) {
    return -7.0;
  }
  if (row.path.trim().toLowerCase() === loweredRawQuery) {
    return -6.5;
  }
  return -6.0;
}

function syntheticLiteralRawScore(row: SearchRow, rawQuery: string, normalizedQuery: string): number {
  const loweredRawQuery = rawQuery.toLowerCase();
  const loweredName = row.name.toLowerCase();
  const loweredSignature = (row.signature ?? "").toLowerCase();
  const loweredBody = row.body.toLowerCase();
  const normalizedName = normalizeLookupValue(row.name);
  const normalizedBody = normalizeLookupValue(row.body);

  if (loweredName === loweredRawQuery || normalizedName === normalizedQuery) {
    return -6.5;
  }
  if (loweredSignature.includes(loweredRawQuery)) {
    return -5.0;
  }
  if (loweredBody.includes(loweredRawQuery) || normalizedBody.includes(normalizedQuery)) {
    return -4.0;
  }
  return -2.5;
}

function computeMatchAnalysis(row: SearchRow, rawQuery: string, options: SearchOptions = {}): MatchAnalysis {
  const trimmedQuery = rawQuery.trim();
  if (!trimmedQuery) {
    return {
      adjustment: 0,
      reason: row.fallback ? "fallback_file" : "body_text",
      confidence: row.fallback ? "fallback" : "related"
    };
  }

  const isSymbolQuery = isSymbolShapedQuery(trimmedQuery);
  const definitionBias = isDefinitionLikeKind(row.kind) ? -1.2 : 0;
  const exactCaseSensitiveName = row.name.trim() === trimmedQuery;
  const exactCaseInsensitiveName = row.name.trim().toLowerCase() === trimmedQuery.toLowerCase();
  const exactCaseSensitiveSignature = (row.signature ?? "").trim() === trimmedQuery;
  const exactCaseInsensitiveSignature = (row.signature ?? "").trim().toLowerCase() === trimmedQuery.toLowerCase();
  const normalizedQuery = normalizeLookupValue(rawQuery);
  if (!normalizedQuery) {
    return {
      adjustment: 0,
      reason: row.fallback ? "fallback_file" : "body_text",
      confidence: row.fallback ? "fallback" : "related"
    };
  }

  const normalizedName = normalizeLookupValue(row.name);
  if (exactCaseSensitiveName) {
    return {
      adjustment: -6.0 + definitionBias,
      reason: "exact_symbol_name",
      confidence: "exact"
    };
  }
  if (exactCaseInsensitiveName) {
    return {
      adjustment: -5.0 + definitionBias,
      reason: "exact_symbol_name",
      confidence: "exact"
    };
  }
  if (exactCaseSensitiveSignature) {
    return {
      adjustment: -4.9 + definitionBias,
      reason: row.kind === "import" ? "import_reference" : "signature_text",
      confidence: "exact"
    };
  }
  if (exactCaseInsensitiveSignature) {
    return {
      adjustment: -4.15 + definitionBias,
      reason: row.kind === "import" ? "import_reference" : "signature_text",
      confidence: "exact"
    };
  }
  if (normalizedName === normalizedQuery) {
    return {
      adjustment: (isSymbolQuery ? -3.25 : -4.5) + definitionBias,
      reason: "normalized_symbol_name",
      confidence: isSymbolQuery ? "strong" : "exact"
    };
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return {
      adjustment: (isSymbolQuery ? -1.75 : -2.5) + definitionBias,
      reason: "normalized_symbol_name",
      confidence: "strong"
    };
  }
  if (normalizedName.includes(normalizedQuery)) {
    return {
      adjustment: (isSymbolQuery ? -0.85 : -0.6) + definitionBias,
      reason: "normalized_symbol_name",
      confidence: isSymbolQuery ? "strong" : "related"
    };
  }

  const conceptPathMatch = isSymbolQuery ? null : analyzeConceptPathMatch(row, rawQuery);
  if (conceptPathMatch) {
    return conceptPathMatch;
  }

  const semanticMatch = analyzeSemanticSimilarity(row);
  if (semanticMatch) {
    return semanticMatch;
  }

  const queryLower = trimmedQuery.toLowerCase();
  const queryTerms = tokenizeLookupTerms(trimmedQuery);
  const matchTerms = conceptualTerms(trimmedQuery);
  const requiredTerms = matchTerms.length > 0 ? matchTerms : queryTerms;
  const normalizedPath = row.path.toLowerCase().replace(/\\/g, "/");
  const signatureLower = (row.signature ?? "").toLowerCase();
  const docLower = (row.doc ?? "").toLowerCase();
  const bodyLower = row.body.toLowerCase();
  const normalizedSignature = normalizeLookupValue(row.signature ?? "");
  const normalizedDoc = normalizeLookupValue(row.doc ?? "");
  const normalizedBody = normalizeLookupValue(row.body);
  const nameTerms = splitCamelCase(row.name);
  const signatureTerms = tokenizeLookupTerms(row.signature ?? "");
  const bodyTerms = tokenizeLookupTerms(row.body);
  const pathTerms = splitCamelCase(normalizedPath);
  const queryTermsPresentInBody = requiredTerms.length > 0 && requiredTerms.every((term) => bodyLower.includes(term));
  const queryTermsPresentInSignature = requiredTerms.length > 0 && requiredTerms.every((term) => signatureLower.includes(term));
  const queryTermsPresentInDoc = requiredTerms.length > 0 && requiredTerms.every((term) => docLower.includes(term));
  const matchedImplementationTerms = countNormalizedConceptMatches(requiredTerms, nameTerms, signatureTerms, bodyTerms);
  const matchedImplementationAndPathTerms = countNormalizedConceptMatches(requiredTerms, nameTerms, signatureTerms, bodyTerms, pathTerms);
  const typedIntent = extractTypedQueryIntent(rawQuery);
  const matchedParameterTypeTerms = countNormalizedConceptMatches(typedIntent.parameterTerms, signatureTerms);
  const matchedReturnTypeTerms = countNormalizedConceptMatches(typedIntent.returnTerms, signatureTerms);
  const strongImplementationBodyMatch = isStrongImplementationBodyMatch(
    row,
    rawQuery,
    options,
    queryTermsPresentInBody,
    queryTermsPresentInSignature,
    queryTermsPresentInDoc
  );

  if (
    isTypedLanguage(row.language)
    && isDefinitionLikeKind(row.kind)
    && (
      (typedIntent.parameterTerms.length > 0 && matchedParameterTypeTerms === normalizeConceptTerms(typedIntent.parameterTerms).length)
      || (typedIntent.returnTerms.length > 0 && matchedReturnTypeTerms === normalizeConceptTerms(typedIntent.returnTerms).length)
    )
  ) {
    return {
      adjustment: -0.9 + definitionBias,
      reason: "signature_text",
      confidence: "strong"
    };
  }

  if (strongImplementationBodyMatch) {
    return {
      adjustment: -0.95 + definitionBias,
      reason: row.kind === "heading" ? "heading_text" : "body_text",
      confidence: "strong"
    };
  }

  if (
    isBroadConceptualCodeQuery(rawQuery, options)
    && matchedImplementationTerms >= 2
    && matchedImplementationAndPathTerms >= 2
    && !row.fallback
    && row.kind !== "import"
    && row.kind !== "file"
    && row.language !== "markdown"
    && isDefinitionLikeKind(row.kind)
    && (normalizedPath.startsWith("src/") || isFrontendImplementationPath(normalizedPath, row.language))
  ) {
    return {
      adjustment: -0.72 + definitionBias,
      reason: "body_text",
      confidence: "strong"
    };
  }

  if (normalizedDoc.includes(normalizedQuery) || docLower.includes(queryLower)) {
    return {
      adjustment: -0.55,
      reason: "doc_text",
      confidence: "strong"
    };
  }
  if (normalizedSignature.includes(normalizedQuery) || signatureLower.includes(queryLower)) {
    return {
      adjustment: isSymbolQuery ? -0.2 : -0.55,
      reason: row.kind === "import" ? "import_reference" : "signature_text",
      confidence: "strong"
    };
  }
  if (normalizedBody.includes(normalizedQuery) || bodyLower.includes(queryLower)) {
    return {
      adjustment: isSymbolQuery ? -0.05 : -0.45,
      reason: row.kind === "import"
        ? "import_reference"
        : row.kind === "heading"
          ? "heading_text"
          : "body_text",
      confidence: "strong"
    };
  }
  if (queryTermsPresentInDoc) {
    return {
      adjustment: -0.3,
      reason: "doc_text",
      confidence: "related"
    };
  }
  if (queryTermsPresentInSignature) {
    return {
      adjustment: isSymbolQuery ? -0.05 : -0.3,
      reason: row.kind === "import" ? "import_reference" : "signature_text",
      confidence: "related"
    };
  }
  if (queryTermsPresentInBody) {
    return {
      adjustment: isSymbolQuery ? 0 : -0.15,
      reason: row.kind === "import"
        ? "import_reference"
        : row.kind === "heading"
          ? "heading_text"
          : "body_text",
      confidence: row.fallback ? "fallback" : "related"
    };
  }

  return {
    adjustment: 0,
    reason: row.fallback ? "fallback_file" : "token_overlap",
    confidence: row.fallback ? "fallback" : "related"
  };
}

function analyzeSemanticSimilarity(row: SearchRow): MatchAnalysis | null {
  const similarity = row.semanticSimilarity ?? null;
  if (similarity === null) {
    return null;
  }

  const definitionBias = isDefinitionLikeKind(row.kind) ? -0.7 : 0;
  if (similarity >= SEMANTIC_EXACT_THRESHOLD) {
    return {
      adjustment: -2.2 + definitionBias,
      reason: "semantic_similarity",
      confidence: "exact"
    };
  }
  if (similarity >= SEMANTIC_STRONG_THRESHOLD) {
    return {
      adjustment: -1.35 + definitionBias,
      reason: "semantic_similarity",
      confidence: "strong"
    };
  }
  if (similarity >= SEMANTIC_RELATED_THRESHOLD) {
    return {
      adjustment: -0.45 + definitionBias,
      reason: "semantic_similarity",
      confidence: "related"
    };
  }
  return null;
}

function isDocOrientedQuery(rawQuery: string): boolean {
  const terms = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  return terms.some((term) => DOC_ORIENTED_QUERY_TERMS.has(term));
}

function isDockerfileInstructionQuery(rawQuery: string): boolean {
  const terms = conceptualTerms(rawQuery);
  if (terms.length === 0) {
    return false;
  }

  const dockerTerms = new Set([
    "dockerfile",
    "docker",
    "from",
    "run",
    "copy",
    "add",
    "cmd",
    "entrypoint",
    "workdir",
    "expose",
    "volume",
    "user",
    "python",
    "pip",
    "requirements",
    "base",
    "image",
    "mkdir"
  ]);

  let matches = 0;
  for (const term of terms) {
    if (dockerTerms.has(term)) {
      matches += 1;
    }
  }
  return matches >= 2;
}

function isTestPath(path: string): boolean {
  const normalizedPath = path.toLowerCase().replace(/\\/g, "/");
  return normalizedPath.startsWith("tests/") || normalizedPath.includes("/test");
}

function normalizePathForHeuristics(path: string): string {
  return path.toLowerCase().replace(/\\/g, "/");
}

function pathMatchesNegativeFilter(path: string, filters: string[] | undefined): boolean {
  if (!filters || filters.length === 0) {
    return false;
  }

  const normalizedPath = normalizePathForHeuristics(path);
  return filters
    .map((filter) => normalizePathForHeuristics(filter).trim())
    .filter(Boolean)
    .some((filter) => normalizedPath.includes(filter));
}

function classifyGraphRootCandidate(input: RootHeuristicInput): string[] {
  const normalizedPath = normalizePathForHeuristics(input.path);
  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const reasons = new Set<string>();

  if (fileName === "__main__.py") {
    reasons.add("python __main__ entrypoint");
  }

  if ([
    "main.py",
    "app.py",
    "cli.py",
    "manage.py",
    "server.py",
    "bootstrap.py",
    "main.js",
    "app.js",
    "cli.js",
    "server.js",
    "main.ts",
    "app.ts",
    "cli.ts",
    "server.ts",
    "startup",
    "start",
    "run",
    "serve"
  ].includes(fileName)) {
    reasons.add("common startup or entrypoint filename");
  }

  if (
    input.language === "shell"
    && ["startup", "start", "run", "serve", "bootstrap"].includes(baseName)
  ) {
    reasons.add("shell startup script name");
  }

  if (
    normalizedPath.startsWith("bin/")
    || normalizedPath.startsWith("scripts/")
    || normalizedPath.includes("/bin/")
    || normalizedPath.includes("/scripts/")
  ) {
    reasons.add("script or bin path");
  }

  if (
    input.language === "css"
    && (
      normalizedPath.startsWith("static/css/")
      || normalizedPath.startsWith("styles/")
      || normalizedPath.includes("/static/css/")
      || normalizedPath.includes("/styles/")
      || normalizedPath.includes("/assets/css/")
    )
  ) {
    reasons.add("frontend stylesheet path");
  }

  if (
    input.language === "javascript"
    || input.language === "typescript"
  ) {
    if (
      normalizedPath.startsWith("dashboard_frontend/")
      || normalizedPath.startsWith("frontend/")
      || normalizedPath.startsWith("web/")
      || normalizedPath.includes("/dashboard_frontend/")
      || normalizedPath.includes("/frontend/")
      || normalizedPath.includes("/web/")
    ) {
      reasons.add("frontend application path");
    }
  }

  const normalizedNames = input.topLevelNames.map((name) => name.toLowerCase());
  if (normalizedNames.includes("main")) {
    reasons.add("top-level main symbol");
  }
  if (normalizedNames.includes("cli") || normalizedNames.includes("run") || normalizedNames.includes("startup")) {
    reasons.add("top-level entry symbol");
  }

  return [...reasons].slice(0, 3);
}

function isRootAwareQuery(rawQuery: string): boolean {
  const terms = conceptualTerms(rawQuery);
  if (terms.length === 0) {
    return false;
  }

  const rootTerms = new Set([
    "main",
    "entrypoint",
    "startup",
    "start",
    "bootstrap",
    "boot",
    "run",
    "serve",
    "server",
    "cli",
    "script",
    "launch",
    "worker"
  ]);

  return terms.some((term) => rootTerms.has(term));
}

function isDocRow(row: SearchRow): boolean {
  return row.language === "markdown";
}

function isCanonicalDocPath(normalizedPath: string): boolean {
  return normalizedPath.startsWith("docs/")
    || normalizedPath === "readme.md"
    || normalizedPath === "plan.md"
    || normalizedPath === "roadmap.md";
}

function isOperationalDocPath(normalizedPath: string): boolean {
  return normalizedPath === "agents.md"
    || normalizedPath === "claude.md"
    || normalizedPath.startsWith(".codex/")
    || normalizedPath.startsWith(".claude/")
    || normalizedPath.startsWith(".symballist/");
}

function isFrontendImplementationPath(normalizedPath: string, language: SearchRow["language"]): boolean {
  if (!["javascript", "typescript", "css", "html"].includes(language)) {
    return false;
  }

  return normalizedPath.startsWith("dashboard_frontend/")
    || normalizedPath.startsWith("frontend/")
    || normalizedPath.startsWith("web/")
    || normalizedPath.startsWith("static/css/")
    || normalizedPath.startsWith("static/js/")
    || normalizedPath.startsWith("styles/")
    || normalizedPath.startsWith("assets/css/")
    || normalizedPath.startsWith("assets/js/")
    || normalizedPath.startsWith("public/")
    || normalizedPath.includes("/dashboard_frontend/")
    || normalizedPath.includes("/frontend/")
    || normalizedPath.includes("/web/")
    || normalizedPath.includes("/static/css/")
    || normalizedPath.includes("/static/js/")
    || normalizedPath.includes("/styles/")
    || normalizedPath.includes("/assets/css/")
    || normalizedPath.includes("/assets/js/")
    || normalizedPath.includes("/public/");
}

function isImplementationFocusedIntent(options: SearchOptions, rawQuery?: string): boolean {
  return options.preferImplementation === true && !options.docsOnly && !isDocOrientedQuery(rawQuery ?? options.rawQuery ?? "");
}

function isBroadConceptualCodeQuery(rawQuery: string, options: SearchOptions): boolean {
  if (options.docsOnly || isDocOrientedQuery(rawQuery) || isSymbolShapedQuery(rawQuery)) {
    return false;
  }
  return conceptualTerms(rawQuery).length >= 2;
}

function isStrongImplementationBodyMatch(
  row: SearchRow,
  rawQuery: string,
  options: SearchOptions,
  queryTermsPresentInBody: boolean,
  queryTermsPresentInSignature: boolean,
  queryTermsPresentInDoc: boolean
): boolean {
  if (!isBroadConceptualCodeQuery(rawQuery, options)) {
    return false;
  }
  if (!queryTermsPresentInBody || queryTermsPresentInSignature || queryTermsPresentInDoc) {
    return false;
  }
  if (row.language === "markdown" || row.fallback || row.kind === "import" || row.kind === "file") {
    return false;
  }
  return true;
}

function rowMatchesIntent(row: SearchRow, options: SearchOptions): boolean {
  if (options.docsOnly && !isDocRow(row)) {
    return false;
  }
  if (options.codeOnly && isDocRow(row)) {
    return false;
  }
  if (isImplementationFocusedIntent(options) && isDocRow(row)) {
    return false;
  }
  if (options.excludeTests && isTestPath(row.path)) {
    return false;
  }
  if (pathMatchesNegativeFilter(row.path, options.excludePaths)) {
    return false;
  }
  return true;
}

function computePathAdjustment(row: SearchRow, rawQuery: string, options: SearchOptions): number {
  const normalizedPath = row.path.toLowerCase().replace(/\\/g, "/");
  const preferImplementation = isImplementationFocusedIntent(options, rawQuery);
  const docsOnly = options.docsOnly === true;
  const dockerfileInstructionQuery = isDockerfileInstructionQuery(rawQuery);
  const broadConceptualCodeQuery = isBroadConceptualCodeQuery(rawQuery, options);

  if (docsOnly) {
    if (normalizedPath.includes("/test") || normalizedPath.startsWith("tests/")) {
      return 0.75;
    }
    if (isOperationalDocPath(normalizedPath)) {
      return 3.0;
    }
    if (normalizedPath.startsWith("docs/")) {
      return -1.2;
    }
    if (normalizedPath === "readme.md") {
      return -1.0;
    }
    if (normalizedPath === "plan.md" || normalizedPath === "roadmap.md") {
      return -0.8;
    }
    return -0.2;
  }

  if (isDocOrientedQuery(rawQuery)) {
    if (isOperationalDocPath(normalizedPath)) {
      return 1.2;
    }
    if (normalizedPath.startsWith("docs/")) {
      return -0.4;
    }
    if (normalizedPath === "readme.md" || normalizedPath === "plan.md") {
      return -0.35;
    }
    if (normalizedPath === "roadmap.md") {
      return -0.25;
    }
    if (normalizedPath.includes("/test") || normalizedPath.startsWith("tests/")) {
      return 0.25;
    }
    return isCanonicalDocPath(normalizedPath) ? -0.1 : 0;
  }

  if (row.language === "markdown") {
    if (preferImplementation) {
      return 2.5;
    }
    if (broadConceptualCodeQuery) {
      return normalizedPath.startsWith("docs/") ? 1.35 : 0.95;
    }
    if (normalizedPath.startsWith("docs/")) {
      return 0.35;
    }
    if (normalizedPath.startsWith(".codex/") || normalizedPath.startsWith(".claude/")) {
      return 0.6;
    }
    return 0.2;
  }

  if (row.kind === "import") {
    if (preferImplementation) {
      return normalizedPath.startsWith("src/") ? 2.1 : 2.6;
    }
    return normalizedPath.startsWith("src/") ? 1.4 : 1.9;
  }

  if (normalizedPath.startsWith("src/")) {
    let adjustment = preferImplementation ? -2.6 : -1.1;
    if (broadConceptualCodeQuery && isDefinitionLikeKind(row.kind)) {
      adjustment -= 0.9;
    }
    return adjustment;
  }
  if (isFrontendImplementationPath(normalizedPath, row.language)) {
    let adjustment = preferImplementation ? -2.15 : -0.85;
    if (broadConceptualCodeQuery && isDefinitionLikeKind(row.kind)) {
      adjustment -= 0.8;
    }
    if ((row.language === "css" || row.language === "html") && (preferImplementation || broadConceptualCodeQuery)) {
      adjustment -= 0.2;
    }
    return adjustment;
  }
  if (normalizedPath.includes("/test") || normalizedPath.startsWith("tests/")) {
    return preferImplementation ? 1.8 : 0.75;
  }
  if (row.language === "dockerfile" && dockerfileInstructionQuery) {
    return row.kind === "file" ? -2.0 : -1.4;
  }

  return 0;
}

function shouldSuppressWeakOperationalDocNoise(rawQuery: string, options: SearchOptions): boolean {
  return !options.docsOnly
    && !options.codeOnly
    && !isImplementationFocusedIntent(options, rawQuery)
    && !isDocOrientedQuery(rawQuery);
}

function computeWeakResultAdjustment(
  row: SearchRow,
  rawQuery: string,
  options: SearchOptions,
  match: MatchAnalysis
): number {
  if (!shouldSuppressWeakOperationalDocNoise(rawQuery, options)) {
    return 0;
  }

  if (match.confidence !== "related" && match.confidence !== "fallback") {
    return 0;
  }

  if (row.language !== "markdown") {
    return 0;
  }

  const normalizedPath = row.path.toLowerCase().replace(/\\/g, "/");
  if (!isOperationalDocPath(normalizedPath)) {
    return 0;
  }

  if (normalizedPath === "agents.md" || normalizedPath === "claude.md") {
    return 3.5;
  }

  return 2.25;
}

function getOperationalDocDuplicateKey(result: RankedQueryResult): string | null {
  const normalizedPath = result.path.toLowerCase().replace(/\\/g, "/");
  if (!isOperationalDocPath(normalizedPath)) {
    return null;
  }

  const normalizedSnippet = normalizeLookupValue(result.snippet).slice(0, 120);
  const normalizedName = normalizeLookupValue(result.name);
  return `${normalizedName}|${normalizedSnippet}`;
}

function collapseWeakOperationalDocDuplicates(
  results: RankedQueryResult[],
  rawQuery: string,
  options: SearchOptions,
  limit: number
): RankedQueryResult[] {
  if (!shouldSuppressWeakOperationalDocNoise(rawQuery, options)) {
    return results.slice(0, limit);
  }

  const topConfidence = results[0]?.confidence ?? null;
  if (topConfidence !== "related" && topConfidence !== "fallback") {
    return results.slice(0, limit);
  }

  const seenOperationalKeys = new Set<string>();
  const filtered: RankedQueryResult[] = [];

  for (const result of results) {
    const duplicateKey = getOperationalDocDuplicateKey(result);
    if (duplicateKey) {
      if (seenOperationalKeys.has(duplicateKey)) {
        continue;
      }
      seenOperationalKeys.add(duplicateKey);
    }

    filtered.push(result);
    if (filtered.length >= limit) {
      break;
    }
  }

  return filtered;
}

function rerankResults(rows: SearchRow[], limit: number, rawQuery: string, options: SearchOptions): RankedQueryResult[] {
  return rows
    .filter((row) => rowMatchesIntent(row, options))
    .map((row) => {
      const match = computeMatchAnalysis(row, rawQuery, options);
      const extraction = getExtractionDetails(row);
      const queryTrust = getQueryTrustDetails(extraction, match.confidence);
      const baseScore = shouldUseSemanticSearch(options)
        ? computeHybridFusionBaseScore(row)
        : row.rawScore;
      const adjustedScore = baseScore
        + (KIND_SCORE_ADJUSTMENTS.get(row.kind) ?? 0)
        + computePathAdjustment(row, rawQuery, options)
        + computeWeakResultAdjustment(row, rawQuery, options, match)
        + match.adjustment;
      return {
        id: row.id,
        path: row.path,
        file: buildFileReference(row.path, row.language),
        location: buildLocation(row.path, row.startLine, row.startColumn, row.endLine, row.endColumn),
        language: row.language,
        kind: row.kind,
        name: row.name,
        signature: row.signature,
        doc: row.doc,
        fallback: Boolean(row.fallback),
        startLine: row.startLine,
        startColumn: row.startColumn,
        endLine: row.endLine,
        endColumn: row.endColumn,
        snippet: makeSnippet(row.body),
        confidence: match.confidence,
        matchReason: match.reason,
        extraction: extraction.extraction,
        trustLevel: extraction.trustLevel,
        retrievalTrustLevel: queryTrust.retrievalTrustLevel,
        semanticSimilarity: row.semanticSimilarity,
        retrievalChannels: getRetrievalChannels(row),
        hybridContribution: getHybridContribution(row),
        graphSignals: [],
        rawScore: row.rawScore,
        adjustedScore
      };
    })
    .sort((left, right) => {
      if (left.adjustedScore !== right.adjustedScore) {
        return left.adjustedScore - right.adjustedScore;
      }
      return left.rawScore - right.rawScore;
    })
    .slice(0, limit)
    .map((result) => ({
      ...result,
      distance: result.adjustedScore
    }));
}

function buildGraphSupportById(
  db: Database,
  candidates: RankedQueryResult[],
  options: SearchOptions,
  rawQuery: string
): Map<number, GraphSupport> {
  const supportById = new Map<number, GraphSupport>();
  if (candidates.length < 2 || options.docsOnly) {
    return supportById;
  }

  const codeCandidates = candidates.filter((candidate) => candidate.language !== "markdown");
  if (codeCandidates.length < 2) {
    return supportById;
  }

  const candidatePaths = [...new Set(codeCandidates.map((candidate) => candidate.path))];
  const pathCounts = new Map<string, number>();
  for (const candidate of codeCandidates) {
    pathCounts.set(candidate.path, (pathCounts.get(candidate.path) ?? 0) + 1);
  }

  const placeholders = candidatePaths.map(() => "?").join(", ");
  const importEdges = db.query(`
    SELECT DISTINCT source_path AS sourcePath, target_path AS targetPath
    FROM relations
    WHERE relation_kind = 'imports'
      AND target_path IS NOT NULL
      AND source_path IN (${placeholders})
      AND target_path IN (${placeholders})
  `).all(...candidatePaths, ...candidatePaths) as Array<{ sourcePath: string; targetPath: string }>;

  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const edge of importEdges) {
    outgoing.set(edge.sourcePath, (outgoing.get(edge.sourcePath) ?? 0) + 1);
    incoming.set(edge.targetPath, (incoming.get(edge.targetPath) ?? 0) + 1);
  }

  const usageEdges = db.query(`
    SELECT DISTINCT source_path AS sourcePath, target_path AS targetPath
    FROM relations
    WHERE relation_kind = 'uses'
      AND target_path IS NOT NULL
      AND source_path IN (${placeholders})
      AND target_path IN (${placeholders})
  `).all(...candidatePaths, ...candidatePaths) as Array<{ sourcePath: string; targetPath: string }>;

  const usageOutgoing = new Map<string, number>();
  const usageIncoming = new Map<string, number>();
  for (const edge of usageEdges) {
    usageOutgoing.set(edge.sourcePath, (usageOutgoing.get(edge.sourcePath) ?? 0) + 1);
    usageIncoming.set(edge.targetPath, (usageIncoming.get(edge.targetPath) ?? 0) + 1);
  }

  const graphEnabled = !options.codeOnly || options.preferImplementation || !isDocOrientedQuery(rawQuery);
  const rootAware = isRootAwareQuery(rawQuery);
  const rootPaths = rootAware
    ? new Set(
        getLikelyGraphRoots(db, Math.max(candidatePaths.length, 12))
          .map((entry) => entry.path)
          .filter((path) => candidatePaths.includes(path))
      )
    : new Set<string>();

  for (const candidate of codeCandidates) {
    if (!graphEnabled) {
      continue;
    }

    let adjustment = 0;
    const signals: GraphSignal[] = [];
    const samePathCount = pathCounts.get(candidate.path) ?? 0;
    if (samePathCount > 1) {
      adjustment -= 0.22 * Math.min(samePathCount - 1, 3);
      signals.push("same_file_cluster");
    }

    const outgoingCount = outgoing.get(candidate.path) ?? 0;
    if (outgoingCount > 0) {
      adjustment -= 0.38 * Math.min(outgoingCount, 2);
      signals.push("imports_candidate");
    }

    const incomingCount = incoming.get(candidate.path) ?? 0;
    if (incomingCount > 0) {
      const incomingWeight = isDefinitionLikeKind(candidate.kind) ? 0.95 : 0.5;
      adjustment -= incomingWeight * Math.min(incomingCount, 2);
      signals.push("imported_by_candidate");
    }

    const usageOutgoingCount = usageOutgoing.get(candidate.path) ?? 0;
    if (usageOutgoingCount > 0) {
      adjustment -= 0.22 * Math.min(usageOutgoingCount, 2);
      signals.push("uses_candidate");
    }

    const usageIncomingCount = usageIncoming.get(candidate.path) ?? 0;
    if (usageIncomingCount > 0) {
      const usageWeight = isDefinitionLikeKind(candidate.kind) ? 0.7 : 0.35;
      adjustment -= usageWeight * Math.min(usageIncomingCount, 2);
      signals.push("used_by_candidate");
    }

    if (rootPaths.has(candidate.path)) {
      adjustment -= isDefinitionLikeKind(candidate.kind) ? 0.45 : 0.2;
      signals.push("root_candidate");
    }

    if (candidate.kind === "import") {
      adjustment *= 0.35;
    }

    if (signals.length > 0) {
      supportById.set(candidate.id, { adjustment, signals });
    }
  }

  return supportById;
}

function applyGraphAwareReranking(
  db: Database,
  candidates: RankedQueryResult[],
  finalLimit: number,
  rawQuery: string,
  options: SearchOptions
): RankedQueryResult[] {
  const graphSupport = buildGraphSupportById(db, candidates, options, rawQuery);
  const reranked = candidates
    .map((candidate) => {
      const support = graphSupport.get(candidate.id);
      if (!support) {
        return candidate;
      }
      return {
        ...candidate,
        graphSignals: support.signals,
        adjustedScore: candidate.adjustedScore + support.adjustment
      };
    })
    .sort((left, right) => {
      if (left.adjustedScore !== right.adjustedScore) {
        return left.adjustedScore - right.adjustedScore;
      }
      return left.rawScore - right.rawScore;
    });

  return collapseWeakOperationalDocDuplicates(reranked, rawQuery, options, finalLimit)
    .map((result) => ({
      ...result,
      distance: result.adjustedScore
    }));
}

export function replaceFileIndex(
  db: Database,
  file: { path: string; language: string; size: number; mtimeMs: number },
  symbols: SymbolRecord[],
  options: { availablePaths?: Set<string> } = {}
): number {
  const previousSymbols = getStoredSymbolsForPath(db, file.path);
  deleteFileIndex(db, file.path);
  db.query("INSERT INTO files (path, language, size, mtime_ms) VALUES (?, ?, ?, ?)").run(
    file.path,
    file.language,
    file.size,
    file.mtimeMs
  );

  const insertSymbol = db.query(`
    INSERT INTO symbols (
      path,
      language,
      kind,
      name,
      signature,
      body,
      doc,
      fallback,
      start_line,
      start_column,
      end_line,
      end_column
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = db.query(`
    INSERT INTO symbols_fts (symbol_id, path, name, kind, signature, body, doc, language, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRelation = db.query(`
    INSERT INTO relations (source_symbol_id, source_path, relation_kind, target_path, target_label)
    VALUES (?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const symbol of symbols) {
    const result = insertSymbol.run(
      symbol.path,
      symbol.language,
      symbol.kind,
      symbol.name,
      symbol.signature,
      symbol.body,
      symbol.doc,
      symbol.fallback ? 1 : 0,
      symbol.startLine,
      symbol.startColumn,
      symbol.endLine,
      symbol.endColumn
    );
    const symbolId = Number(result.lastInsertRowid);
    insertFts.run(
      symbolId,
      symbol.path,
      symbol.name,
      symbol.kind,
      symbol.signature ?? "",
      symbol.body,
      symbol.doc ?? "",
      symbol.language,
      [symbol.name, symbol.signature ?? "", symbol.doc ?? "", symbol.body].join("\n")
    );

    if (symbol.kind !== "file") {
      insertRelation.run(symbolId, symbol.path, "contained_in", symbol.path, symbol.path);
    }

    if (symbol.language === "python" && symbol.kind === "import") {
      for (const relation of extractImportRelations(symbol.name, symbol.path, options.availablePaths ?? new Set())) {
        insertRelation.run(symbolId, symbol.path, relation.kind, relation.targetPath, relation.targetLabel);
      }
    }
    for (const relation of symbol.relations ?? []) {
      insertRelation.run(symbolId, symbol.path, relation.kind, relation.targetPath, relation.targetLabel);
    }
    count += 1;
  }

  const changes = diffSymbols(previousSymbols, symbols);
  if (changes.added.length > 0 || changes.removed.length > 0 || changes.changed.length > 0) {
    accumulateSymbolChanges(db, changes);
  }

  return count;
}

export function getIndexedFiles(db: Database): IndexedFileRow[] {
  const rows = db.query(`
    SELECT
      path,
      language,
      size,
      mtime_ms AS mtimeMs
    FROM files
  `);
  return rows.all() as IndexedFileRow[];
}

function getStoredSymbolsForPath(db: Database, path: string): SymbolRecord[] {
  const rows = db.query(`
    SELECT
      path,
      language,
      kind,
      name,
      signature,
      body,
      doc,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn
    FROM symbols
    WHERE path = ?
    ORDER BY start_line, start_column, end_line, end_column, kind, name, id
  `).all(path) as Array<SymbolRecord>;

  return rows.map((row) => ({
    ...row,
    fallback: Boolean(row.fallback)
  }));
}

function symbolIdentity(symbol: SymbolRecord): string {
  return [symbol.path, symbol.kind, symbol.name, symbol.signature ?? ""].join("\u001f");
}

function symbolFingerprint(symbol: SymbolRecord): string {
  return [
    symbol.path,
    symbol.kind,
    symbol.name,
    symbol.signature ?? "",
    symbol.doc ?? "",
    symbol.body,
    symbol.startLine,
    symbol.startColumn,
    symbol.endLine,
    symbol.endColumn,
    symbol.fallback ? "1" : "0"
  ].join("\u001f");
}

function sampleSymbol(symbol: SymbolRecord): SymbolChangeSample {
  return {
    path: symbol.path,
    kind: symbol.kind,
    name: symbol.name
  };
}

function pushBoundedSample(target: SymbolChangeSample[], sample: SymbolChangeSample): void {
  if (target.length >= MAX_SYMBOL_CHANGE_SAMPLES) {
    return;
  }
  if (target.some((entry) => entry.path === sample.path && entry.kind === sample.kind && entry.name === sample.name)) {
    return;
  }
  target.push(sample);
}

function accumulateSymbolChanges(db: Database, changes: { added: SymbolRecord[]; removed: SymbolRecord[]; changed: SymbolRecord[] }): void {
  const summary = readStoredSymbolChangeSummary(db);
  summary.addedCount += changes.added.length;
  summary.removedCount += changes.removed.length;
  summary.changedCount += changes.changed.length;

  for (const symbol of changes.added) {
    pushBoundedSample(summary.added, sampleSymbol(symbol));
  }
  for (const symbol of changes.removed) {
    pushBoundedSample(summary.removed, sampleSymbol(symbol));
  }
  for (const symbol of changes.changed) {
    pushBoundedSample(summary.changed, sampleSymbol(symbol));
  }

  writeStoredSymbolChangeSummary(db, summary);
}

function diffSymbols(previous: SymbolRecord[], next: SymbolRecord[]): { added: SymbolRecord[]; removed: SymbolRecord[]; changed: SymbolRecord[] } {
  const previousByIdentity = new Map(previous.map((symbol) => [symbolIdentity(symbol), symbol]));
  const nextByIdentity = new Map(next.map((symbol) => [symbolIdentity(symbol), symbol]));
  const added: SymbolRecord[] = [];
  const removed: SymbolRecord[] = [];
  const changed: SymbolRecord[] = [];

  for (const [identity, nextSymbol] of nextByIdentity) {
    const previousSymbol = previousByIdentity.get(identity);
    if (!previousSymbol) {
      added.push(nextSymbol);
      continue;
    }
    if (symbolFingerprint(previousSymbol) !== symbolFingerprint(nextSymbol)) {
      changed.push(nextSymbol);
    }
  }

  for (const [identity, previousSymbol] of previousByIdentity) {
    if (!nextByIdentity.has(identity)) {
      removed.push(previousSymbol);
    }
  }

  return { added, removed, changed };
}

export function resetLatestSymbolChangeSummary(db: Database): void {
  writeStoredSymbolChangeSummary(db, defaultSymbolChangeSummary());
}

export function getLatestSymbolChangeSummary(db: Database): SymbolChangeSummary {
  const summary = readStoredSymbolChangeSummary(db);
  return {
    ...summary,
    truncated: summary.addedCount > summary.added.length
      || summary.removedCount > summary.removed.length
      || summary.changedCount > summary.changed.length
  };
}

export function deleteFileIndex(db: Database, path: string): void {
  const clearSymbols = db.query("SELECT id FROM symbols WHERE path = ?").all(path) as Array<{ id: number }>;
  const deleteFts = db.query("DELETE FROM symbols_fts WHERE symbol_id = ?");
  const deleteRelationsBySymbol = db.query("DELETE FROM relations WHERE source_symbol_id = ?");
  const deleteEmbeddings = db.query("DELETE FROM symbol_embeddings WHERE symbol_id = ?");
  for (const row of clearSymbols) {
    deleteFts.run(row.id);
    deleteRelationsBySymbol.run(row.id);
    deleteEmbeddings.run(row.id);
  }

  db.query("DELETE FROM relations WHERE source_path = ?").run(path);
  db.query("DELETE FROM symbols WHERE path = ?").run(path);
  db.query("DELETE FROM files WHERE path = ?").run(path);
}

export function getStatusSummary(db: Database): StatusSummary {
  const counts = db.query(`
    SELECT
      (SELECT COUNT(*) FROM files) AS indexedFiles,
      (SELECT COUNT(*) FROM symbols) AS indexedSymbols,
      (SELECT COUNT(*) FROM symbols WHERE fallback = 1) AS fallbackSymbols
  `).get() as {
    indexedFiles: number;
    indexedSymbols: number;
    fallbackSymbols: number;
  };

  const languageRows = db.query(`
    SELECT DISTINCT language
    FROM files
    ORDER BY language
  `).all() as Array<{ language: string }>;

  return {
    indexedFiles: counts.indexedFiles,
    indexedSymbols: counts.indexedSymbols,
    fallbackSymbols: counts.fallbackSymbols,
    languages: languageRows.map((row) => row.language),
    schemaVersion: getSchemaVersion(db),
    indexFormatVersion: getIndexFormatVersion(db) ?? 0,
    indexScopeSignature: getIndexedScopeSignature(db)
  };
}

export function getLikelyGraphRoots(db: Database, limit = 12): GraphRootCandidate[] {
  const rows = db.query(`
    SELECT
      files.path AS path,
      files.language AS language,
      symbols.name AS name
    FROM files
    LEFT JOIN symbols
      ON symbols.path = files.path
      AND symbols.kind NOT IN ('import', 'file')
      AND symbols.start_line <= 160
    ORDER BY files.path, symbols.start_line, symbols.id
  `).all() as Array<{
    path: string;
    language: SymbolRecord["language"];
    name: string | null;
  }>;

  const byPath = new Map<string, RootHeuristicInput>();
  for (const row of rows) {
    const existing = byPath.get(row.path);
    if (!existing) {
      byPath.set(row.path, {
        path: row.path,
        language: row.language,
        topLevelNames: row.name ? [row.name] : []
      });
      continue;
    }
    if (row.name) {
      existing.topLevelNames.push(row.name);
    }
  }

  return [...byPath.values()]
    .map((entry) => ({
      path: entry.path,
      language: entry.language,
      reasons: classifyGraphRootCandidate(entry)
    }))
    .filter((entry) => entry.reasons.length > 0)
    .sort((left, right) => {
      if (right.reasons.length !== left.reasons.length) {
        return right.reasons.length - left.reasons.length;
      }
      return left.path.localeCompare(right.path);
    })
    .slice(0, limit);
}

function buildGraphDiagnostics(db: Database, symbol: GraphDiagnosticContext): GraphDiagnostics {
  const inboundRows = db.query(`
    SELECT DISTINCT source_path AS sourcePath
    FROM relations
    WHERE relation_kind IN ('imports', 'uses')
      AND target_path = ?
  `).all(symbol.path) as Array<{ sourcePath: string }>;

  const outboundRows = db.query(`
    SELECT DISTINCT target_path AS targetPath
    FROM relations
    WHERE (
      (source_symbol_id = ? AND relation_kind IN ('imports', 'uses'))
      OR (source_path = ? AND relation_kind = 'imports')
    )
      AND target_path IS NOT NULL
  `).all(symbol.id, symbol.path) as Array<{ targetPath: string }>;
  const outboundRelationRows = db.query(`
    SELECT target_path AS targetPath
    FROM relations
    WHERE (
      (source_symbol_id = ? AND relation_kind IN ('imports', 'uses'))
      OR (source_path = ? AND relation_kind = 'imports')
    )
      AND target_path IS NOT NULL
  `).all(symbol.id, symbol.path) as Array<{ targetPath: string }>;

  const knownInboundReferences = inboundRows.length;
  const knownOutboundReferences = outboundRows.length;
  const inboundReferencesFromTestsOnly = knownInboundReferences > 0 && inboundRows.every((row) => isTestPath(row.sourcePath));
  const allConnectedPaths = [
    ...inboundRows.map((row) => row.sourcePath),
    ...outboundRows.map((row) => row.targetPath)
  ];
  const sameFileConnectivityOnly = allConnectedPaths.length > 0 && allConnectedPaths.every((path) => path === symbol.path);
  const rootReasons = classifyGraphRootCandidate({
    path: symbol.path,
    language: symbol.language,
    topLevelNames: [symbol.name]
  });
  const rootLike = rootReasons.length > 0;
  const disconnectedFromIndexedGraph = knownInboundReferences === 0 && knownOutboundReferences === 0 && !rootLike;
  const possibleOrphanCandidate = knownInboundReferences === 0 && !rootLike && !sameFileConnectivityOnly;
  const possibleOrphanReasons: string[] = [];
  if (possibleOrphanCandidate) {
    possibleOrphanReasons.push("no known inbound references");
    possibleOrphanReasons.push("not classified as a likely root");
    if (sameFileConnectivityOnly) {
      possibleOrphanReasons.push("connectivity stays within the same file");
    }
    if (disconnectedFromIndexedGraph) {
      possibleOrphanReasons.push("disconnected from the indexed graph");
    }
  }

  const notes: string[] = [];
  if (knownInboundReferences === 0) {
    notes.push("No known inbound references in the indexed graph.");
  }
  if (inboundReferencesFromTestsOnly) {
    notes.push("Known inbound references come only from test paths.");
  }
  if (sameFileConnectivityOnly) {
    notes.push("Known graph connectivity stays within the same file.");
  }
  if (disconnectedFromIndexedGraph) {
    notes.push("No known inbound or outbound references were found in the indexed graph.");
  }
  if (knownOutboundReferences > 0 && outboundRelationRows.length > knownOutboundReferences) {
    notes.push("knownOutboundReferences counts unique connected target paths; graph traversal may show multiple relation entries to the same target.");
  }
  if (rootLike) {
    notes.push("This symbol or file looks like a startup or entrypoint root based on lightweight heuristics.");
  }

  return {
    knownInboundReferences,
    knownOutboundReferences,
    inboundReferencesFromTestsOnly,
    sameFileConnectivityOnly,
    disconnectedFromIndexedGraph,
    rootLike,
    possibleOrphanCandidate,
    possibleOrphanReasons,
    rootReasons,
    notes
  };
}

export function getPossibleOrphanCandidates(db: Database, limit = 12): PossibleOrphanCandidate[] {
  const rows = db.query(`
    WITH inbound AS (
      SELECT
        target_path AS path,
        COUNT(DISTINCT source_path) AS inbound_count,
        COUNT(DISTINCT CASE WHEN source_path != target_path THEN source_path END) AS inbound_non_same_count
      FROM relations
      WHERE relation_kind IN ('imports', 'uses')
        AND target_path IS NOT NULL
      GROUP BY target_path
    ),
    outbound AS (
      SELECT
        symbol_id,
        COUNT(DISTINCT target_path) AS outbound_count,
        COUNT(DISTINCT CASE WHEN target_path != source_path THEN target_path END) AS outbound_non_same_count
      FROM (
        SELECT
          source_symbol_id AS symbol_id,
          source_path,
          target_path
        FROM relations
        WHERE source_symbol_id IS NOT NULL
          AND relation_kind IN ('imports', 'uses')
          AND target_path IS NOT NULL

        UNION ALL

        SELECT
          symbols.id AS symbol_id,
          relations.source_path,
          relations.target_path
        FROM relations
        JOIN symbols
          ON symbols.path = relations.source_path
        WHERE relations.relation_kind = 'imports'
          AND relations.target_path IS NOT NULL
      ) outbound_rows
      GROUP BY symbol_id
    )
    SELECT
      symbols.id AS id,
      symbols.path AS path,
      symbols.language AS language,
      symbols.kind AS kind,
      symbols.name AS name,
      symbols.fallback AS fallback,
      COALESCE(inbound.inbound_count, 0) AS inboundCount,
      COALESCE(inbound.inbound_non_same_count, 0) AS inboundNonSameCount,
      COALESCE(outbound.outbound_count, 0) AS outboundCount,
      COALESCE(outbound.outbound_non_same_count, 0) AS outboundNonSameCount
    FROM symbols
    LEFT JOIN inbound
      ON inbound.path = symbols.path
    LEFT JOIN outbound
      ON outbound.symbol_id = symbols.id
    WHERE kind NOT IN ('import', 'file')
    ORDER BY path, start_line, id
  `).all() as Array<{
    id: number;
    path: string;
    language: SymbolRecord["language"];
    kind: string;
    name: string;
    fallback: number;
    inboundCount: number;
    inboundNonSameCount: number;
    outboundCount: number;
    outboundNonSameCount: number;
  }>;

  return rows
    .filter((row) => !Boolean(row.fallback))
    .filter((row) => row.language !== "markdown")
    .filter((row) => !isTestPath(row.path))
    .filter((row) => isDefinitionLikeKind(row.kind))
    .map((row) => {
      const rootReasons = classifyGraphRootCandidate({
        path: row.path,
        language: row.language,
        topLevelNames: [row.name]
      });
      const rootLike = rootReasons.length > 0;
      const totalConnections = row.inboundCount + row.outboundCount;
      const nonSameFileConnections = row.inboundNonSameCount + row.outboundNonSameCount;
      const sameFileConnectivityOnly = totalConnections > 0 && nonSameFileConnections === 0;
      const possibleOrphanCandidate = row.inboundCount === 0 && !rootLike && !sameFileConnectivityOnly;

      return {
        row,
        possibleOrphanCandidate,
        outboundCount: row.outboundCount
      };
    })
    .filter((entry) => entry.possibleOrphanCandidate)
    .sort((left, right) => {
      if (left.outboundCount !== right.outboundCount) {
        return left.outboundCount - right.outboundCount;
      }
      return left.row.path.localeCompare(right.row.path);
    })
    .slice(0, limit)
    .map((entry) => ({
      id: entry.row.id,
      path: entry.row.path,
      language: entry.row.language,
      kind: entry.row.kind,
      name: entry.row.name,
      reasons: ["no known inbound references", "not classified as a likely root"]
    }));
}

export function getEmbeddingSummary(
  db: Database,
  provider: "ollama" | null,
  model: string | null
): EmbeddingSummary {
  const totals = db.query(`
    SELECT
      (SELECT COUNT(*) FROM symbol_embeddings) AS totalEmbeddings,
      (SELECT COUNT(*) FROM symbol_embeddings WHERE provider = ? AND model = ?) AS matchingEmbeddings
  `).get(provider ?? "", model ?? "") as {
    totalEmbeddings: number;
    matchingEmbeddings: number;
  };

  return totals;
}

export function getEmbeddableSymbolsForPath(db: Database, path: string): EmbeddableSymbolRow[] {
  return db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      doc,
      body
    FROM symbols
    WHERE path = ?
    ORDER BY id
  `).all(path) as EmbeddableSymbolRow[];
}

export function getEmbeddingCountForPath(
  db: Database,
  path: string,
  provider: "ollama",
  model: string
): number {
  const row = db.query(`
    SELECT COUNT(*) AS count
    FROM symbol_embeddings
    JOIN symbols ON symbols.id = symbol_embeddings.symbol_id
    WHERE symbols.path = ?
      AND symbol_embeddings.provider = ?
      AND symbol_embeddings.model = ?
  `).get(path, provider, model) as { count: number } | null;

  return row?.count ?? 0;
}

export function replaceSymbolEmbeddings(
  db: Database,
  embeddings: Array<{
    symbolId: number;
    provider: "ollama";
    model: string;
    dimensions: number;
    embedding: number[];
  }>
): void {
  const deleteEmbedding = db.query("DELETE FROM symbol_embeddings WHERE symbol_id = ?");
  const insertEmbedding = db.query(`
    INSERT INTO symbol_embeddings (symbol_id, provider, model, dimensions, embedding_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const entry of embeddings) {
    deleteEmbedding.run(entry.symbolId);
    if (entry.embedding.length === 0) {
      continue;
    }
    insertEmbedding.run(
      entry.symbolId,
      entry.provider,
      entry.model,
      entry.dimensions,
      JSON.stringify(entry.embedding)
    );
  }
}

export function getSymbolById(db: Database, id: number): SymbolDetails | null {
  const row = db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      body,
      doc,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn
    FROM symbols
    WHERE id = ?
  `).get(id);

  if (!row) {
    return null;
  }

  const details = row as SymbolDetailsRow;
  const extraction = getExtractionDetails(details);
  return {
    ...details,
    file: buildFileReference(details.path, details.language),
    location: buildLocation(details.path, details.startLine, details.startColumn, details.endLine, details.endColumn),
    graphDiagnostics: buildGraphDiagnostics(db, details),
    extraction: extraction.extraction,
    trustLevel: extraction.trustLevel,
    fallback: Boolean(details.fallback)
  };
}

export function getBestSymbolByName(db: Database, rawName: string, options: SymbolLookupOptions = {}): SymbolDetails | null {
  const variants = lookupLiteralVariants(rawName);
  if (variants.length === 0) {
    return null;
  }
  const normalizedName = rawName.trim();
  const normalizedVariants = [...new Set(variants.map((variant) => normalizeLookupValue(variant)).filter(Boolean))];

  const kinds = [...new Set((options.kinds ?? []).map((kind) => kind.trim()).filter(Boolean))];
  const whereKindClause = kinds.length > 0
    ? ` AND kind IN (${kinds.map(() => "?").join(", ")})`
    : "";
  const exactPlaceholders = variants.map(() => "?").join(", ");
  const normalizedPlaceholders = normalizedVariants.map(() => "?").join(", ");
  const exactNameClause = `lower(name) IN (${exactPlaceholders})`;
  const exactSignatureClause = `lower(COALESCE(signature, '')) IN (${exactPlaceholders})`;
  const normalizedSignatureSuffixClause = normalizedVariants.length > 0
    ? ` OR ${normalizedLookupSql("COALESCE(signature, '')")} LIKE '%' || ?`
    : "";
  const normalizedClause = normalizedVariants.length > 0
    ? ` OR ${normalizedLookupSql("name")} IN (${normalizedPlaceholders})
        OR ${normalizedLookupSql("COALESCE(signature, '')")} IN (${normalizedPlaceholders})
        ${normalizedSignatureSuffixClause}`
    : "";
  const exactValues = variants.map((variant) => variant.toLowerCase());

  const rows = db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      doc,
      body,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn,
      0.0 AS rawScore
    FROM symbols
    WHERE (
      ${exactNameClause}
      OR ${exactSignatureClause}
      ${normalizedClause}
    )
    ${whereKindClause}
    ORDER BY
      CASE
        WHEN ${exactNameClause} THEN 0
        WHEN ${exactSignatureClause} THEN 1
        ${normalizedVariants.length > 0 ? `WHEN ${normalizedLookupSql("name")} IN (${normalizedPlaceholders}) THEN 2
        WHEN ${normalizedLookupSql("COALESCE(signature, '')")} IN (${normalizedPlaceholders}) THEN 3
        WHEN ${normalizedLookupSql("COALESCE(signature, '')")} LIKE '%' || ? THEN 4` : ""}
        ELSE 5
      END,
      CASE kind
        WHEN 'class' THEN 0
        WHEN 'module' THEN 1
        WHEN 'method' THEN 2
        WHEN 'function' THEN 3
        ELSE 4
      END,
      start_line ASC,
      id ASC
    LIMIT 50
  `).all(
    ...exactValues,
    ...exactValues,
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? [normalizedVariants[0]!] : []),
    ...kinds
    ,
    ...exactValues,
    ...exactValues,
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? normalizedVariants : []),
    ...(normalizedVariants.length > 0 ? [normalizedVariants[0]!] : [])
  ) as SearchRow[];

  const rankedRows = rows.map((row, index) => ({
    ...row,
    semanticSimilarity: row.semanticSimilarity ?? null,
    lexicalCandidate: true,
    conceptCandidate: false,
    semanticCandidate: false,
    lexicalRank: index + 1,
    conceptRank: null,
    semanticRank: null
  }));

  const [best] = rerankResults(rankedRows, 1, normalizedName, {});
  if (!best) {
    return null;
  }

  return getSymbolById(db, best.id);
}

export function getRelationsForSymbol(db: Database, symbol: SymbolDetails): RelationDetails[] {
  const rows = db.query(`
    SELECT DISTINCT
      relation_kind AS kind,
      target_path AS targetPath,
      target_label AS targetLabel
    FROM relations
    WHERE source_symbol_id = ?
      OR (source_path = ? AND relation_kind = 'imports')
    ORDER BY relation_kind, target_label
  `).all(symbol.id, symbol.path) as RelationRow[];

  return rows.map((row) => ({
    kind: row.kind,
    targetPath: row.targetPath,
    targetLabel: row.targetLabel
  }));
}

export function getRelatedSymbolsForSymbol(db: Database, symbol: SymbolDetails, limit = 5): RelatedSymbol[] {
  const relations = getRelationsForSymbol(db, symbol);
  const seenRelationTargets = new Set<string>();
  const related: RelatedSymbol[] = [];

  for (const relation of relations) {
    if (related.length >= limit) {
      break;
    }

    const candidates = relation.kind === "contained_in"
      ? getContainerSymbolCandidates(db, symbol)
      : getTargetSymbolCandidates(db, relation);

    for (const candidate of candidates) {
      const relationKey = `${relation.kind}\u001f${candidate.id}`;
      if (candidate.id === symbol.id || seenRelationTargets.has(relationKey)) {
        continue;
      }

      seenRelationTargets.add(relationKey);
      related.push({ relation, symbol: candidate });
      break;
    }
  }

  return related;
}

export function getGraphTraversalForSymbol(db: Database, symbol: SymbolDetails, limit = 5): GraphTraversalEntry[] {
  const traversals: GraphTraversalEntry[] = [];
  const seen = new Set<string>();

  const pushTraversal = (traversal: GraphTraversalKind, relation: RelationDetails, candidates: SymbolDetails[]): void => {
    for (const candidate of candidates) {
      if (candidate.id === symbol.id) {
        continue;
      }
      const key = `${traversal}\u001f${candidate.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      traversals.push({
        traversal,
        relation,
        symbol: candidate
      });
      break;
    }
  };

  for (const relation of getRelationsForSymbol(db, symbol)) {
    if (relation.kind === "contained_in") {
      pushTraversal("contained_in", relation, getContainerSymbolCandidates(db, symbol));
      continue;
    }
    pushTraversal(relation.kind, relation, getTargetSymbolCandidates(db, relation));
  }

  const inboundRelations = getInboundRelationsForSymbol(db, symbol, ["imports", "uses"]);
  for (const relation of inboundRelations) {
    const traversal = relation.kind === "imports" ? "imported_by" : "used_by";
    pushTraversal(traversal, relation, getSourceSymbolCandidates(db, relation));
  }

  return traversals.slice(0, limit);
}

export function searchSymbols(db: Database, query: string, limit: number, options: SearchOptions = {}): QueryResult[] {
  return searchSymbolsWithDiagnostics(db, query, limit, options).results;
}

export function searchSymbolsWithDiagnostics(
  db: Database,
  query: string,
  limit: number,
  options: SearchOptions = {}
): SearchExecution {
  const kinds = [...new Set((options.kinds ?? []).map((kind) => kind.trim()).filter(Boolean))];
  const whereKindClause = kinds.length > 0
    ? ` AND symbols.kind IN (${kinds.map(() => "?").join(", ")})`
    : "";

  const statement = db.query(`
    SELECT
      symbols.id,
      symbols.path,
      symbols.language,
      symbols.kind,
      symbols.name,
      symbols.signature,
      symbols.doc,
      symbols.body,
      symbols.fallback,
      symbols.start_line AS startLine,
      symbols.start_column AS startColumn,
      symbols.end_line AS endLine,
      symbols.end_column AS endColumn,
      bm25(symbols_fts) AS rawScore,
      NULL AS semanticSimilarity
    FROM symbols_fts
    JOIN symbols ON symbols.id = symbols_fts.symbol_id
    WHERE symbols_fts MATCH ?
    ${whereKindClause}
    ORDER BY rawScore
    LIMIT ?
  `);

  const candidateLimit = Math.max(limit * 10, 100);
  const rawQuery = options.rawQuery ?? query;
  let rows: SearchRow[];
  try {
    rows = (statement.all(query, ...kinds, candidateLimit) as SearchRow[]).map((row, index) => ({
      ...row,
      lexicalCandidate: true,
      conceptCandidate: false,
      semanticCandidate: false,
      lexicalRank: index + 1,
      conceptRank: null,
      semanticRank: null
    }));
  } catch {
    rows = getLiteralFallbackCandidates(db, rawQuery, kinds, candidateLimit);
  }
  if (rows.length === 0) {
    rows = getLiteralFallbackCandidates(db, rawQuery, kinds, candidateLimit);
  }
  rows = rows.map((row, index) => ({
    ...row,
    lexicalRank: row.lexicalRank ?? index + 1,
    conceptRank: row.conceptRank ?? null,
    semanticRank: row.semanticRank ?? null
  }));
  const supplementalRows = shouldExpandConceptCandidates(rawQuery, options)
    ? getConceptPathCandidates(db, rawQuery, kinds, candidateLimit)
    : [];
  const exactLookupRows = getExactLookupCandidates(db, rawQuery, kinds, Math.max(limit * 2, 10));
  const semanticRows = shouldUseSemanticSearch(options)
    ? getSemanticCandidates(db, options.queryEmbedding ?? [], options.embeddingProvider ?? null, options.embeddingModel ?? null, kinds, candidateLimit)
    : [];
  const mergedRows = mergeSearchRows(rows, exactLookupRows, supplementalRows, semanticRows);
  const candidatePoolLimit = Math.max(limit * 4, 20);
  const rankedPool = rerankResults(mergedRows, candidatePoolLimit, rawQuery, options);
  const rankedResults = applyGraphAwareReranking(db, rankedPool, limit, rawQuery, options);

  return {
    results: attachRelativeScores(rankedResults.map(({ adjustedScore, rawScore: _rawScore, ...result }) => ({
      ...result,
      distance: adjustedScore,
      graphDiagnostics: buildGraphDiagnostics(db, result)
    }))),
    diagnostics: buildSearchDiagnostics(mergeSearchRows(rows, exactLookupRows), supplementalRows, semanticRows, rankedResults)
  };
}

function shouldExpandConceptCandidates(rawQuery: string, options: SearchOptions): boolean {
  return !options.docsOnly
    && !isDocOrientedQuery(rawQuery)
    && !isSymbolShapedQuery(rawQuery)
    && conceptualTerms(rawQuery).length > 0;
}

function mergeSearchRows(...rowSets: SearchRow[][]): SearchRow[] {
  const merged = new Map<number, SearchRow>();

  for (const rows of rowSets) {
    for (const row of rows) {
      const existing = merged.get(row.id);
      if (!existing) {
        merged.set(row.id, row);
        continue;
      }

      merged.set(row.id, {
        ...existing,
        rawScore: Math.min(existing.rawScore, row.rawScore),
        semanticSimilarity: Math.max(existing.semanticSimilarity ?? Number.NEGATIVE_INFINITY, row.semanticSimilarity ?? Number.NEGATIVE_INFINITY),
        lexicalCandidate: existing.lexicalCandidate || row.lexicalCandidate,
        conceptCandidate: existing.conceptCandidate || row.conceptCandidate,
        semanticCandidate: existing.semanticCandidate || row.semanticCandidate,
        lexicalRank: minRank(existing.lexicalRank, row.lexicalRank),
        conceptRank: minRank(existing.conceptRank, row.conceptRank),
        semanticRank: minRank(existing.semanticRank, row.semanticRank)
      });
    }
  }

  return [...merged.values()].map((row) => ({
    ...row,
    semanticSimilarity: row.semanticSimilarity === Number.NEGATIVE_INFINITY ? null : row.semanticSimilarity
  }));
}

function roundRelativeSignal(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function attachRelativeScores(results: Array<Omit<QueryResult, "score" | "scoreMarginFromTop"> & { distance: number }>): QueryResult[] {
  if (results.length === 0) {
    return [];
  }

  const topDistance = results[0]?.distance ?? 0;
  const worstDistance = results.reduce((max, result) => Math.max(max, result.distance), topDistance);
  const spread = worstDistance - topDistance;

  return results.map((result) => {
    const deltaFromTop = Math.max(0, result.distance - topDistance);
    const normalizedMargin = spread > 0 ? deltaFromTop / spread : 0;
    const relativeScore = spread > 0 ? 1 - normalizedMargin : 1;

    return {
      ...result,
      score: roundRelativeSignal(Math.min(1, Math.max(0, relativeScore))),
      scoreMarginFromTop: roundRelativeSignal(Math.min(1, Math.max(0, normalizedMargin)))
    };
  });
}

function getConceptPathCandidates(
  db: Database,
  rawQuery: string,
  kinds: string[],
  limit: number
): SearchRow[] {
  const queryTerms = conceptualTerms(rawQuery);
  if (queryTerms.length === 0) {
    return [];
  }

  const likeClauses = queryTerms.map(() => "lower(symbols.path) LIKE ?");
  const kindClause = kinds.length > 0
    ? ` AND symbols.kind IN (${kinds.map(() => "?").join(", ")})`
    : "";

  const rows = db.query(`
    SELECT
      symbols.id,
      symbols.path,
      symbols.language,
      symbols.kind,
      symbols.name,
      symbols.signature,
      symbols.doc,
      symbols.body,
      symbols.fallback,
      symbols.start_line AS startLine,
      symbols.start_column AS startColumn,
      symbols.end_line AS endLine,
      symbols.end_column AS endColumn,
      0.0 AS rawScore,
      NULL AS semanticSimilarity
    FROM symbols
    WHERE symbols.kind NOT IN ('import', 'file')
      AND (${likeClauses.join(" AND ")})
      ${kindClause}
    ORDER BY
      CASE
        WHEN lower(symbols.path) LIKE ? THEN 0
        ELSE 1
      END,
      CASE symbols.kind
        WHEN 'class' THEN 0
        WHEN 'function' THEN 1
        WHEN 'heading' THEN 2
        ELSE 3
      END,
      symbols.start_line ASC,
      symbols.id ASC
    LIMIT ?
  `).all(
    ...queryTerms.map((term) => `%${term}%`),
    ...kinds,
    `%${normalizeLookupValue(rawQuery)}%`,
    limit
  ) as SearchRow[];

  return rows.map((row, index) => ({
    ...row,
    rawScore: syntheticConceptRawScore(row, rawQuery),
    semanticSimilarity: null,
    lexicalCandidate: false,
    conceptCandidate: true,
    semanticCandidate: false,
    lexicalRank: null,
    conceptRank: index + 1,
    semanticRank: null
  }));
}

function shouldUseSemanticSearch(options: SearchOptions): boolean {
  return Boolean(options.queryEmbedding && options.queryEmbedding.length > 0 && options.embeddingProvider && options.embeddingModel);
}

function parseEmbeddingJson(value: string): number[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  } catch {
    return [];
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length);
  if (size === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < size; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function getSemanticCandidates(
  db: Database,
  queryEmbedding: number[],
  provider: "ollama" | null,
  model: string | null,
  kinds: string[],
  limit: number
): SearchRow[] {
  if (!provider || !model || queryEmbedding.length === 0) {
    return [];
  }

  const kindClause = kinds.length > 0
    ? ` AND symbols.kind IN (${kinds.map(() => "?").join(", ")})`
    : "";

  const rows = db.query(`
    SELECT
      symbols.id,
      symbols.path,
      symbols.language,
      symbols.kind,
      symbols.name,
      symbols.signature,
      symbols.doc,
      symbols.body,
      symbols.fallback,
      symbols.start_line AS startLine,
      symbols.start_column AS startColumn,
      symbols.end_line AS endLine,
      symbols.end_column AS endColumn,
      symbol_embeddings.embedding_json AS embeddingJson
    FROM symbol_embeddings
    JOIN symbols ON symbols.id = symbol_embeddings.symbol_id
    WHERE symbol_embeddings.provider = ?
      AND symbol_embeddings.model = ?
      ${kindClause}
  `).all(provider, model, ...kinds) as Array<Omit<SearchRow, "rawScore" | "semanticSimilarity"> & { embeddingJson: string }>;

  return rows
    .map((row, index) => {
      const similarity = cosineSimilarity(queryEmbedding, parseEmbeddingJson(row.embeddingJson));
      return {
        ...row,
        rawScore: -similarity,
        semanticSimilarity: similarity,
        lexicalCandidate: false,
        conceptCandidate: false,
        semanticCandidate: true,
        lexicalRank: null,
        conceptRank: null,
        semanticRank: index + 1
      };
    })
    .filter((row) => row.semanticSimilarity !== null && (row.semanticSimilarity ?? 0) >= SEMANTIC_RELATED_THRESHOLD)
    .sort((left, right) => (right.semanticSimilarity ?? 0) - (left.semanticSimilarity ?? 0))
    .slice(0, limit);
}

function syntheticConceptRawScore(row: SearchRow, rawQuery: string): number {
  const conceptMatch = analyzeConceptPathMatch(row, rawQuery);
  if (!conceptMatch) {
    return -2.5;
  }
  if (conceptMatch.confidence === "strong") {
    return -7.5;
  }
  return -5.5;
}

function minRank(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return Math.min(left, right);
}

function computeHybridFusionBaseScore(row: SearchRow): number {
  const lexicalContribution = row.lexicalRank === null ? 0 : (3.4 / (row.lexicalRank + 1));
  const conceptContribution = row.conceptRank === null ? 0 : (2.8 / (row.conceptRank + 1));
  const semanticContribution = row.semanticRank === null
    ? 0
    : (5.8 / (row.semanticRank + 1)) + ((row.semanticSimilarity ?? 0) * 2.1);

  let score = -(lexicalContribution + conceptContribution + semanticContribution);

  if (row.semanticRank !== null && row.lexicalRank === null && row.conceptRank === null) {
    score -= 0.75;
  }

  return score;
}

function getRetrievalChannels(row: SearchRow): RetrievalChannel[] {
  const channels: RetrievalChannel[] = [];
  if (row.lexicalCandidate) {
    channels.push("lexical");
  }
  if (row.conceptCandidate) {
    channels.push("concept_path");
  }
  if (row.semanticCandidate) {
    channels.push("semantic");
  }
  return channels;
}

function getHybridContribution(row: SearchRow): HybridContribution {
  if (row.semanticCandidate && (row.lexicalCandidate || row.conceptCandidate)) {
    return "semantic_assisted";
  }
  if (row.semanticCandidate) {
    return "semantic_only";
  }
  return "lexical_only";
}

function buildSearchDiagnostics(
  lexicalRows: SearchRow[],
  conceptRows: SearchRow[],
  semanticRows: SearchRow[],
  rankedResults: RankedQueryResult[]
): SearchDiagnostics {
  const retainedRanks = new Map<number, number>();
  for (const [index, result] of rankedResults.entries()) {
    retainedRanks.set(result.id, index + 1);
  }

  const mergedSemanticIds = new Set<number>(semanticRows.map((row) => row.id));
  const semanticRetained = rankedResults.filter((result) => result.retrievalChannels.includes("semantic"));
  const topSemanticCandidate = [...semanticRows]
    .sort((left, right) => (right.semanticSimilarity ?? 0) - (left.semanticSimilarity ?? 0))[0] ?? null;

  return {
    lexicalCandidates: lexicalRows.length,
    conceptCandidates: conceptRows.length,
    semanticCandidatesRetrieved: semanticRows.length,
    semanticCandidatesMerged: mergedSemanticIds.size,
    semanticCandidatesRetained: semanticRetained.length,
    topResultHasSemanticSignal: rankedResults[0]?.retrievalChannels.includes("semantic") ?? false,
    topSemanticCandidate: topSemanticCandidate ? {
      id: topSemanticCandidate.id,
      path: topSemanticCandidate.path,
      kind: topSemanticCandidate.kind,
      name: topSemanticCandidate.name,
      semanticSimilarity: topSemanticCandidate.semanticSimilarity ?? 0,
      retained: retainedRanks.has(topSemanticCandidate.id),
      resultRank: retainedRanks.get(topSemanticCandidate.id) ?? null
    } : null
  };
}

function extractImportRelations(statement: string, sourcePath: string, availablePaths: Set<string>): RelationDetails[] {
  const normalized = statement.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  if (normalized.startsWith("import ")) {
    return normalized
      .slice("import ".length)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(/\s+as\s+/i)[0]?.trim() ?? "")
      .filter(Boolean)
      .map((moduleName) => ({
        kind: "imports" as const,
        targetPath: resolvePythonModulePath(moduleName, sourcePath, availablePaths),
        targetLabel: moduleName
      }));
  }

  const match = normalized.match(/^from\s+([.\w]+)\s+import\s+(.+)$/i);
  if (!match) {
    return [];
  }

  const [, moduleName, importedSection] = match;
  const targetPath = resolvePythonModulePath(moduleName, sourcePath, availablePaths);
  const importedNames = importedSection
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+as\s+/i)[0]?.trim() ?? "")
    .filter(Boolean);

  if (importedNames.length === 0) {
    return [{
      kind: "imports",
      targetPath,
      targetLabel: moduleName
    }];
  }

  return importedNames.map((importedName) => ({
    kind: "imports" as const,
    targetPath: resolveImportedTargetPath(moduleName, importedName, sourcePath, availablePaths) ?? targetPath,
    targetLabel: `${moduleName}.${importedName}`
  }));
}

function resolveImportedTargetPath(
  moduleName: string,
  importedName: string,
  sourcePath: string,
  availablePaths: Set<string>
): string | null {
  const trimmedModule = moduleName.trim();
  const trimmedImport = importedName.trim();
  if (!trimmedModule || !trimmedImport || trimmedImport === "*") {
    return null;
  }

  const separator = trimmedModule.endsWith(".") ? "" : ".";
  return resolvePythonModulePath(`${trimmedModule}${separator}${trimmedImport}`, sourcePath, availablePaths);
}

function resolvePythonModulePath(moduleName: string, sourcePath: string, availablePaths: Set<string>): string | null {
  const trimmed = moduleName.trim();
  if (!trimmed) {
    return null;
  }

  const relativeDots = trimmed.match(/^\.+/)?.[0].length ?? 0;
  const bareModule = trimmed.slice(relativeDots);
  const sourceDir = dirname(sourcePath);
  let baseDir = relativeDots > 0 ? sourceDir : "";

  for (let index = 1; index < relativeDots; index += 1) {
    baseDir = dirname(baseDir);
  }

  const moduleSegments = bareModule ? bareModule.split(".").filter(Boolean) : [];
  const baseCandidate = normalize(join(baseDir, ...moduleSegments));
  const candidates = [
    `${baseCandidate}.py`,
    join(baseCandidate, "__init__.py")
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    if (availablePaths.has(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  return null;
}

function getTargetSymbolCandidates(db: Database, relation: RelationDetails): SymbolDetails[] {
  if (!relation.targetPath) {
    return [];
  }

  const preferredName = relation.targetLabel
    .split(/::|\./)
    .at(-1)
    ?.trim()
    ?? relation.targetLabel;
  const rows = db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      body,
      doc,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn
    FROM symbols
    WHERE path = ?
      AND kind NOT IN ('import', 'file')
    ORDER BY
      CASE
        WHEN lower(name) = lower(?) THEN 0
        WHEN lower(name) LIKE lower(?) THEN 1
        ELSE 2
      END,
      CASE kind
        WHEN 'class' THEN 0
        WHEN 'function' THEN 1
        WHEN 'title' THEN 2
        WHEN 'element' THEN 3
        ELSE 4
      END,
      start_line,
      id
    LIMIT 5
  `).all(relation.targetPath, preferredName, `%${preferredName}%`) as SymbolDetailsRow[];

  return rows.map((row) => ({
    ...row,
    fallback: Boolean(row.fallback)
  }));
}

function getSourceSymbolCandidates(db: Database, relation: InboundRelationRow): SymbolDetails[] {
  if (!relation.targetPath) {
    return [];
  }

  const preferredName = relation.targetLabel
    .split(/::|\./)
    .at(-1)
    ?.trim()
    ?? relation.targetLabel;
  const rows = db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      body,
      doc,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn
    FROM symbols
    WHERE path = ?
      AND kind NOT IN ('import', 'file')
    ORDER BY
      CASE
        WHEN lower(name) = lower(?) THEN 0
        WHEN lower(COALESCE(signature, '')) LIKE lower(?) THEN 1
        WHEN lower(body) LIKE lower(?) THEN 2
        ELSE 3
      END,
      CASE kind
        WHEN 'class' THEN 0
        WHEN 'function' THEN 1
        WHEN 'title' THEN 2
        WHEN 'element' THEN 3
        ELSE 4
      END,
      start_line,
      id
    LIMIT 5
  `).all(relation.sourcePath, preferredName, `%${preferredName}%`, `%${preferredName}%`) as SymbolDetailsRow[];

  return rows.map((row) => ({
    ...row,
    fallback: Boolean(row.fallback)
  }));
}

function getInboundRelationsForSymbol(
  db: Database,
  symbol: SymbolDetails,
  kinds: Array<"imports" | "uses">
): InboundRelationRow[] {
  if (kinds.length === 0) {
    return [];
  }

  const rows = db.query(`
    SELECT DISTINCT
      source_path AS sourcePath,
      relation_kind AS kind,
      target_path AS targetPath,
      target_label AS targetLabel
    FROM relations
    WHERE target_path = ?
      AND relation_kind IN (${kinds.map(() => "?").join(", ")})
    ORDER BY relation_kind, target_label
  `).all(symbol.path, ...kinds) as InboundRelationRow[];

  return rows.map((row) => ({
    sourcePath: row.sourcePath,
    kind: row.kind,
    targetPath: row.targetPath,
    targetLabel: row.targetLabel
  }));
}

function getContainerSymbolCandidates(db: Database, symbol: SymbolDetails): SymbolDetails[] {
  const rows = db.query(`
    SELECT
      id,
      path,
      language,
      kind,
      name,
      signature,
      body,
      doc,
      fallback,
      start_line AS startLine,
      start_column AS startColumn,
      end_line AS endLine,
      end_column AS endColumn
    FROM symbols
    WHERE path = ?
      AND id != ?
      AND kind NOT IN ('import', 'file')
      AND (
        start_line < ?
        OR (start_line = ? AND start_column <= ?)
      )
      AND (
        end_line > ?
        OR (end_line = ? AND end_column >= ?)
      )
    ORDER BY
      ((end_line - start_line) * 1000 + (end_column - start_column)) ASC,
      start_line ASC,
      id ASC
    LIMIT 3
  `).all(
    symbol.path,
    symbol.id,
    symbol.startLine,
    symbol.startLine,
    symbol.startColumn,
    symbol.endLine,
    symbol.endLine,
    symbol.endColumn
  ) as SymbolDetailsRow[];

  return rows.map((row) => ({
    ...row,
    fallback: Boolean(row.fallback)
  }));
}
