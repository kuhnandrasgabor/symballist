import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { appPath, DB_FILE } from "./config.ts";
import type { QueryResult, RelatedSymbol, RelationDetails, SymbolDetails, SymbolRecord } from "./types.ts";

export const CURRENT_SCHEMA_VERSION = 5;

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

type SearchRow = Omit<QueryResult, "snippet" | "fallback"> & { body: string; fallback: number };
type SymbolDetailsRow = Omit<SymbolDetails, "fallback"> & { fallback: number };
type RelationRow = {
  kind: RelationDetails["kind"];
  targetPath: string | null;
  targetLabel: string;
};
type SearchOptions = {
  kinds?: string[];
  rawQuery?: string;
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

function computeDirectMatchAdjustment(row: SearchRow, rawQuery: string): number {
  const trimmedQuery = rawQuery.trim();
  if (!trimmedQuery) {
    return 0;
  }

  const isSymbolQuery = isSymbolShapedQuery(trimmedQuery);
  const definitionBias = isDefinitionLikeKind(row.kind) ? -1.2 : 0;
  const exactCaseSensitiveName = row.name.trim() === trimmedQuery;
  const exactCaseInsensitiveName = row.name.trim().toLowerCase() === trimmedQuery.toLowerCase();
  const normalizedQuery = normalizeLookupValue(rawQuery);
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedName = normalizeLookupValue(row.name);
  if (exactCaseSensitiveName) {
    return -6.0 + definitionBias;
  }
  if (exactCaseInsensitiveName) {
    return -5.0 + definitionBias;
  }
  if (normalizedName === normalizedQuery) {
    return (isSymbolQuery ? -3.25 : -4.5) + definitionBias;
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return (isSymbolQuery ? -1.75 : -2.5) + definitionBias;
  }
  if (normalizedName.includes(normalizedQuery)) {
    return (isSymbolQuery ? -0.85 : -1.5) + definitionBias;
  }

  const queryLower = trimmedQuery.toLowerCase();
  const signatureLower = (row.signature ?? "").toLowerCase();
  const bodyLower = row.body.toLowerCase();
  if (signatureLower.includes(queryLower)) {
    return isSymbolQuery ? -0.05 : -0.4;
  }
  if (bodyLower.includes(queryLower)) {
    return isSymbolQuery ? 0 : -0.2;
  }

  return 0;
}

function isDocOrientedQuery(rawQuery: string): boolean {
  const terms = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  return terms.some((term) => DOC_ORIENTED_QUERY_TERMS.has(term));
}

function computePathAdjustment(row: SearchRow, rawQuery: string): number {
  const normalizedPath = row.path.toLowerCase().replace(/\\/g, "/");

  if (isDocOrientedQuery(rawQuery)) {
    if (normalizedPath.startsWith("docs/")) {
      return -0.4;
    }
    if (normalizedPath === "readme.md" || normalizedPath === "plan.md") {
      return -0.35;
    }
    if (normalizedPath.includes("/test") || normalizedPath.startsWith("tests/")) {
      return 0.25;
    }
    return 0;
  }

  if (row.language === "markdown") {
    if (normalizedPath.startsWith("docs/")) {
      return 0.35;
    }
    if (normalizedPath.startsWith(".codex/") || normalizedPath.startsWith(".claude/")) {
      return 0.6;
    }
    return 0.2;
  }

  if (row.kind === "import") {
    return normalizedPath.startsWith("src/") ? 1.4 : 1.9;
  }

  if (normalizedPath.startsWith("src/")) {
    return -1.1;
  }
  if (normalizedPath.includes("/test") || normalizedPath.startsWith("tests/")) {
    return 0.75;
  }

  return 0;
}

function rerankResults(rows: SearchRow[], limit: number, rawQuery: string): QueryResult[] {
  return rows
    .map(({ body, ...row }) => ({
      ...row,
      fallback: Boolean(row.fallback),
      snippet: makeSnippet(body),
      adjustedScore: row.score
        + (KIND_SCORE_ADJUSTMENTS.get(row.kind) ?? 0)
        + computePathAdjustment({ body, ...row }, rawQuery)
        + computeDirectMatchAdjustment({ body, ...row }, rawQuery)
    }))
    .sort((left, right) => {
      if (left.adjustedScore !== right.adjustedScore) {
        return left.adjustedScore - right.adjustedScore;
      }
      return left.score - right.score;
    })
    .slice(0, limit)
    .map(({ adjustedScore: _adjustedScore, ...result }) => result);
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
  for (const row of clearSymbols) {
    deleteFts.run(row.id);
    deleteRelationsBySymbol.run(row.id);
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
  return {
    ...details,
    fallback: Boolean(details.fallback)
  };
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
      bm25(symbols_fts) AS score
    FROM symbols_fts
    JOIN symbols ON symbols.id = symbols_fts.symbol_id
    WHERE symbols_fts MATCH ?
    ${whereKindClause}
    ORDER BY score
    LIMIT ?
  `);

  const candidateLimit = Math.max(limit * 10, 100);
  const rows = statement.all(query, ...kinds, candidateLimit) as SearchRow[];
  return rerankResults(rows, limit, options.rawQuery ?? query);
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
