import {
  buildFtsQuery,
  getIndexedFiles,
  getRelatedSymbolsForSymbol,
  getRelationsForSymbol,
  getSymbolById,
  openDatabase,
  searchSymbols
} from "../db.ts";
import { embedTexts, getActiveEmbeddingsConfig, summarizeEmbeddingSupport } from "../embeddings.ts";
import { detectIndexFreshness } from "../freshness.ts";
import { readConfig } from "../fs.ts";
import type { QueryIntentOptions } from "../types.ts";
import { summarizeBody } from "./show.ts";

export async function runLookup(
  root: string,
  rawQuery: string,
  limit: number,
  kinds: string[] = [],
  intent: QueryIntentOptions = {},
  options: { full?: boolean } = {}
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
  const selectedResult = results[0] ?? null;
  const symbol = selectedResult ? getSymbolById(db, selectedResult.id) : null;
  const relations = symbol ? getRelationsForSymbol(db, symbol) : [];
  const related = symbol ? getRelatedSymbolsForSymbol(db, symbol) : [];
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));
  db.close();

  const body = symbol ? summarizeBody(symbol.body, options.full === true) : null;

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
    trustSemantics: {
      selectedSymbolTrustLevel: "extraction trust for the resolved top result symbol"
    },
    selectedResult,
    symbol: symbol ? {
      ...symbol,
      body: body?.body ?? symbol.body
    } : null,
    bodyPresentation: body?.presentation ?? null,
    relations,
    related,
    alternatives: results.slice(1)
  }, null, 2));
}
