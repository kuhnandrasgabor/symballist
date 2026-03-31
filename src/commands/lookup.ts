import {
  buildFtsQuery,
  getIndexedFiles,
  getRelatedSymbolsForSymbol,
  getRelationsForSymbol,
  getSymbolById,
  openDatabase,
  searchSymbolsWithDiagnostics
} from "../db.ts";
import { embedTexts, getActiveEmbeddingsConfig, summarizeEmbeddingSupport } from "../embeddings.ts";
import { detectIndexFreshness } from "../freshness.ts";
import { readConfig } from "../fs.ts";
import type { QueryIntentOptions } from "../types.ts";
import { summarizeRetrievalQuality } from "./resultQuality.ts";
import { summarizeBody } from "./show.ts";

export async function runLookup(
  root: string,
  rawQuery: string,
  limit: number,
  kinds: string[] = [],
  intent: QueryIntentOptions = {},
  options: { full?: boolean; compact?: boolean } = {}
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
  const search = searchSymbolsWithDiagnostics(db, ftsQuery, limit, {
    kinds,
    rawQuery: normalizedQuery,
    embeddingProvider: activeEmbeddings?.provider ?? null,
    embeddingModel: activeEmbeddings?.model ?? null,
    queryEmbedding,
    ...intent
  });
  const selectedResult = search.results[0] ?? null;
  const symbol = selectedResult ? getSymbolById(db, selectedResult.id) : null;
  const relations = symbol ? getRelationsForSymbol(db, symbol) : [];
  const related = symbol ? getRelatedSymbolsForSymbol(db, symbol) : [];
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));
  db.close();
  const resultQuality = summarizeRetrievalQuality(search.results);

  const body = symbol ? summarizeBody(symbol.body, options.full === true) : null;

  const payload = {
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
      },
      hybrid: queryEmbedding ? search.diagnostics : null
    },
    ...(options.compact === true ? {} : {
      resultSemantics: {
      distance: "lower is better",
      confidenceOrder: ["exact", "strong", "related", "fallback"],
      trustLevels: ["high", "medium", "low"],
      trustLevel: "extraction trust; how confidently the symbol boundaries/body were extracted",
      retrievalTrustLevel: "retrieval trust; how confidently this query matched the result",
      locationFields: "path remains the canonical file path; file.path and location.path are duplicated for consumers that expect explicit file/location objects. Compact mode preserves these fields.",
      graphDiagnostics: "graphDiagnostics are index-bounded structural signals for the returned results, such as no known inbound references, test-only inbound references, same-file-only connectivity, disconnected-from-indexed-graph, and root-like status. They are not dead-code claims.",
      retrievalChannels: ["lexical", "concept_path", "semantic"],
      hybridContribution: "lexical_only means no semantic candidate was retained; semantic_only means the result came from embeddings without lexical admission; semantic_assisted means both channels admitted the result",
      graphSignals: "same_file_cluster, imports_candidate, imported_by_candidate, uses_candidate, used_by_candidate, and root_candidate reflect one-hop graph-aware reranking signals from the current candidate neighborhood"
      },
      trustSemantics: {
        selectedSymbolTrustLevel: "extraction trust for the resolved top result symbol",
        graphDiagnostics: "selected symbol graphDiagnostics describe what the current index knows structurally about this symbol; they do not claim whether code is truly unused."
      }
    }),
    resultQuality,
    selectedResult,
    symbol: symbol ? {
      ...symbol,
      body: body?.body ?? symbol.body
    } : null,
    bodyPresentation: body?.presentation ?? null,
    relations,
    related,
    alternatives: search.results.slice(1)
  };

  console.log(JSON.stringify(payload, null, 2));
}
