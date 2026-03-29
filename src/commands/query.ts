import { getIndexedFiles, openDatabase, searchSymbols } from "../db.ts";
import { detectIndexFreshness } from "../freshness.ts";

export async function runQuery(root: string, rawQuery: string, limit: number, kinds: string[] = []): Promise<void> {
  const normalizedQuery = rawQuery.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) {
    throw new Error("Query text is required.");
  }

  const db = await openDatabase(root);
  const terms = normalizedQuery
    .split(" ")
    .map((term) => term.replace(/"/g, ""))
    .filter(Boolean);
  const ftsQuery = terms.length > 1 ? terms.join(" OR ") : terms[0] ?? normalizedQuery;
  const results = searchSymbols(db, ftsQuery, limit, { kinds, rawQuery: normalizedQuery });
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));
  db.close();

  console.log(JSON.stringify({ query: rawQuery, kinds, indexFreshness, results }, null, 2));
}
