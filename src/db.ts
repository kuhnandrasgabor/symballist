import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { appPath, DB_FILE } from "./config.ts";
import type { QueryResult, SymbolDetails, SymbolRecord } from "./types.ts";

export const CURRENT_SCHEMA_VERSION = 3;

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
type SearchOptions = {
  kinds?: string[];
};

const KIND_SCORE_ADJUSTMENTS = new Map<string, number>([
  ["class", -1.1],
  ["function", -1.0],
  ["title", -0.75],
  ["element", -0.5],
  ["import", 0.75],
  ["file", 1.0]
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

function rerankResults(rows: SearchRow[], limit: number): QueryResult[] {
  return rows
    .map(({ body, ...row }) => ({
      ...row,
      fallback: Boolean(row.fallback),
      snippet: makeSnippet(body),
      adjustedScore: row.score + (KIND_SCORE_ADJUSTMENTS.get(row.kind) ?? 0)
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
  symbols: SymbolRecord[]
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
  for (const row of clearSymbols) {
    deleteFts.run(row.id);
  }

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

  const candidateLimit = Math.max(limit * 5, limit);
  const rows = statement.all(query, ...kinds, candidateLimit) as SearchRow[];
  return rerankResults(rows, limit);
}
