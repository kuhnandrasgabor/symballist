import { buildFtsQuery, getIndexedFiles, openDatabase, searchSymbols } from "../db.ts";
import { detectIndexFreshness } from "../freshness.ts";
import type { QueryIntentOptions } from "../types.ts";

export async function runQuery(
  root: string,
  rawQuery: string,
  limit: number,
  kinds: string[] = [],
  intent: QueryIntentOptions = {}
): Promise<void> {
  const normalizedQuery = rawQuery.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) {
    throw new Error("Query text is required.");
  }

  const db = await openDatabase(root);
  const ftsQuery = buildFtsQuery(normalizedQuery);
  const results = searchSymbols(db, ftsQuery, limit, {
    kinds,
    rawQuery: normalizedQuery,
    ...intent
  });
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));
  db.close();

  console.log(JSON.stringify({
    query: rawQuery,
    kinds,
    intent,
    indexFreshness,
    resultSemantics: {
      distance: "lower is better",
      confidenceOrder: ["exact", "strong", "related", "fallback"],
      trustLevels: ["high", "medium", "low"]
    },
    results
  }, null, 2));
}
