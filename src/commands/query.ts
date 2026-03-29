import { buildFtsQuery, getIndexedFiles, openDatabase, searchSymbols } from "../db.ts";
import { embedTexts, getActiveEmbeddingsConfig, summarizeEmbeddingSupport } from "../embeddings.ts";
import { detectIndexFreshness } from "../freshness.ts";
import { readConfig } from "../fs.ts";
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

  const config = await readConfig(root);
  const db = await openDatabase(root);
  const embeddingSupport = summarizeEmbeddingSupport(db, config);
  const activeEmbeddings = getActiveEmbeddingsConfig(config);
  let queryEmbedding: number[] | null = null;
  let embeddingQueryError: string | null = null;
  if (activeEmbeddings && embeddingSupport.available) {
    try {
      const embeddingResult = await embedTexts(activeEmbeddings, [normalizedQuery]);
      queryEmbedding = embeddingResult.embeddings[0] ?? null;
    } catch (error) {
      embeddingQueryError = error instanceof Error ? error.message : String(error);
    }
  }
  const ftsQuery = buildFtsQuery(normalizedQuery);
  const results = searchSymbols(db, ftsQuery, limit, {
    kinds,
    rawQuery: normalizedQuery,
    embeddingProvider: activeEmbeddings?.provider ?? null,
    embeddingModel: activeEmbeddings?.model ?? null,
    queryEmbedding,
    ...intent
  });
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));
  db.close();

  console.log(JSON.stringify({
    query: rawQuery,
    kinds,
    intent,
    indexFreshness,
    retrieval: {
      mode: queryEmbedding ? "hybrid" : "lexical",
      embeddings: {
        ...embeddingSupport,
        queryEmbedded: queryEmbedding !== null,
        queryError: embeddingQueryError
      }
    },
    resultSemantics: {
      distance: "lower is better",
      confidenceOrder: ["exact", "strong", "related", "fallback"],
      trustLevels: ["high", "medium", "low"],
      trustLevel: "extraction trust; how confidently the symbol boundaries/body were extracted",
      retrievalTrustLevel: "retrieval trust; how confidently this query matched the result"
    },
    results
  }, null, 2));
}
