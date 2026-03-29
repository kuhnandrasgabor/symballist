import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { appPath, DB_FILE } from "./config.ts";
import type {
  ExtractionKind,
  MatchReason,
  QueryResult,
  RelatedSymbol,
  RelationDetails,
  ResultConfidence,
  SymbolDetails,
  SymbolLookupOptions,
  QueryIntentOptions,
  SymbolRecord,
  TrustLevel
} from "./types.ts";

export const CURRENT_SCHEMA_VERSION = 6;
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
};
type SymbolDetailsRow = Omit<SymbolDetails, "fallback"> & { fallback: number };
type RelationRow = {
  kind: RelationDetails["kind"];
  targetPath: string | null;
  targetLabel: string;
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

const SEMANTIC_EXACT_THRESHOLD = 0.92;
const SEMANTIC_STRONG_THRESHOLD = 0.82;
const SEMANTIC_RELATED_THRESHOLD = 0.68;

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
  `);

  ensureColumn(db, "symbols", "start_line", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "symbols", "start_column", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "symbols", "end_line", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "symbols", "end_column", "INTEGER NOT NULL DEFAULT 1");

  const schemaVersion = getSchemaVersion(db);
  if (schemaVersion < CURRENT_SCHEMA_VERSION) {
    clearIndexData(db);
    setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
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

function tokenizeLookupTerms(value: string): string[] {
  return value
    .split(/[^A-Za-z0-9]+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
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

  if ((row.doc ?? "").startsWith("Recovered from oversized Python file")) {
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

  const queryTerms = tokenizeLookupTerms(rawQuery);
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
  const terms = rawQuery
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/"/g, ""))
    .filter(Boolean);

  if (terms.length === 0) {
    return rawQuery.trim();
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

function computeMatchAnalysis(row: SearchRow, rawQuery: string): MatchAnalysis {
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
  const signatureLower = (row.signature ?? "").toLowerCase();
  const docLower = (row.doc ?? "").toLowerCase();
  const bodyLower = row.body.toLowerCase();
  const normalizedSignature = normalizeLookupValue(row.signature ?? "");
  const normalizedDoc = normalizeLookupValue(row.doc ?? "");
  const normalizedBody = normalizeLookupValue(row.body);
  const queryTermsPresentInBody = queryTerms.length > 0 && queryTerms.every((term) => bodyLower.includes(term));
  const queryTermsPresentInSignature = queryTerms.length > 0 && queryTerms.every((term) => signatureLower.includes(term));
  const queryTermsPresentInDoc = queryTerms.length > 0 && queryTerms.every((term) => docLower.includes(term));

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

function isTestPath(path: string): boolean {
  const normalizedPath = path.toLowerCase().replace(/\\/g, "/");
  return normalizedPath.startsWith("tests/") || normalizedPath.includes("/test");
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

function isImplementationFocusedIntent(options: SearchOptions, rawQuery?: string): boolean {
  return options.preferImplementation === true && !options.docsOnly && !isDocOrientedQuery(rawQuery ?? options.rawQuery ?? "");
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
  return true;
}

function computePathAdjustment(row: SearchRow, rawQuery: string, options: SearchOptions): number {
  const normalizedPath = row.path.toLowerCase().replace(/\\/g, "/");
  const preferImplementation = isImplementationFocusedIntent(options, rawQuery);
  const docsOnly = options.docsOnly === true;

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
    return preferImplementation ? -2.6 : -1.1;
  }
  if (normalizedPath.includes("/test") || normalizedPath.startsWith("tests/")) {
    return preferImplementation ? 1.8 : 0.75;
  }

  return 0;
}

function rerankResults(rows: SearchRow[], limit: number, rawQuery: string, options: SearchOptions): QueryResult[] {
  return rows
    .filter((row) => rowMatchesIntent(row, options))
    .map((row) => {
      const match = computeMatchAnalysis(row, rawQuery);
      const extraction = getExtractionDetails(row);
      const queryTrust = getQueryTrustDetails(extraction, match.confidence);
      const adjustedScore = row.rawScore
        + (KIND_SCORE_ADJUSTMENTS.get(row.kind) ?? 0)
        + computePathAdjustment(row, rawQuery, options)
        + match.adjustment;
      return {
        id: row.id,
        path: row.path,
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
    .map(({ adjustedScore, rawScore: _rawScore, ...result }) => ({
      ...result,
      distance: adjustedScore
    }));
}

export function replaceFileIndex(
  db: Database,
  file: { path: string; language: string; size: number; mtimeMs: number },
  symbols: SymbolRecord[],
  options: { availablePaths?: Set<string> } = {}
): number {
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
    count += 1;
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
    schemaVersion: getSchemaVersion(db)
  };
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
    extraction: extraction.extraction,
    trustLevel: extraction.trustLevel,
    fallback: Boolean(details.fallback)
  };
}

export function getBestSymbolByName(db: Database, rawName: string, options: SymbolLookupOptions = {}): SymbolDetails | null {
  const normalizedName = rawName.trim();
  if (!normalizedName) {
    return null;
  }

  const kinds = [...new Set((options.kinds ?? []).map((kind) => kind.trim()).filter(Boolean))];
  const whereKindClause = kinds.length > 0
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
      0.0 AS rawScore
    FROM symbols
    WHERE lower(name) = lower(?)
    ${whereKindClause}
    LIMIT 50
  `).all(normalizedName, ...kinds) as SearchRow[];

  const [best] = rerankResults(rows, 1, normalizedName, {});
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
  const seenSymbolIds = new Set<number>();
  const related: RelatedSymbol[] = [];

  for (const relation of relations) {
    if (related.length >= limit) {
      break;
    }

    const candidates = relation.kind === "imports"
      ? getImportedSymbolCandidates(db, relation)
      : getContainerSymbolCandidates(db, symbol);

    for (const candidate of candidates) {
      if (candidate.id === symbol.id || seenSymbolIds.has(candidate.id)) {
        continue;
      }

      seenSymbolIds.add(candidate.id);
      related.push({ relation, symbol: candidate });
      break;
    }
  }

  return related;
}

export function searchSymbols(db: Database, query: string, limit: number, options: SearchOptions = {}): QueryResult[] {
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
  const rows = statement.all(query, ...kinds, candidateLimit) as SearchRow[];
  const supplementalRows = shouldExpandConceptCandidates(rawQuery, options)
    ? getConceptPathCandidates(db, rawQuery, kinds, candidateLimit)
    : [];
  const semanticRows = shouldUseSemanticSearch(options)
    ? getSemanticCandidates(db, options.queryEmbedding ?? [], options.embeddingProvider ?? null, options.embeddingModel ?? null, kinds, candidateLimit)
    : [];

  return rerankResults(mergeSearchRows(rows, supplementalRows, semanticRows), limit, rawQuery, options);
}

function shouldExpandConceptCandidates(rawQuery: string, options: SearchOptions): boolean {
  return !options.docsOnly
    && !isDocOrientedQuery(rawQuery)
    && !isSymbolShapedQuery(rawQuery)
    && tokenizeLookupTerms(rawQuery).length > 0;
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
        semanticSimilarity: Math.max(existing.semanticSimilarity ?? Number.NEGATIVE_INFINITY, row.semanticSimilarity ?? Number.NEGATIVE_INFINITY)
      });
    }
  }

  return [...merged.values()].map((row) => ({
    ...row,
    semanticSimilarity: row.semanticSimilarity === Number.NEGATIVE_INFINITY ? null : row.semanticSimilarity
  }));
}

function getConceptPathCandidates(
  db: Database,
  rawQuery: string,
  kinds: string[],
  limit: number
): SearchRow[] {
  const queryTerms = tokenizeLookupTerms(rawQuery);
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

  return rows.map((row) => ({
    ...row,
    rawScore: syntheticConceptRawScore(row, rawQuery),
    semanticSimilarity: null
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
    .map((row) => {
      const similarity = cosineSimilarity(queryEmbedding, parseEmbeddingJson(row.embeddingJson));
      return {
        ...row,
        rawScore: -similarity,
        semanticSimilarity: similarity
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
    targetPath,
    targetLabel: `${moduleName}.${importedName}`
  }));
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

function getImportedSymbolCandidates(db: Database, relation: RelationDetails): SymbolDetails[] {
  if (!relation.targetPath) {
    return [];
  }

  const preferredName = relation.targetLabel.split(".").at(-1) ?? relation.targetLabel;
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
