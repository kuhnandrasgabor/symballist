import { buildFtsQuery, getIndexedFiles, openDatabase, recordImpactTrackingEvent, searchSymbolsWithDiagnostics } from "../db.ts";
import { embedTexts, getActiveEmbeddingsConfig, summarizeEmbeddingSupport } from "../embeddings.ts";
import { detectIndexFreshness } from "../freshness.ts";
import { readConfig } from "../fs.ts";
import type { QueryIntentOptions } from "../types.ts";
import { summarizeRetrievalQuality } from "./resultQuality.ts";

type QueryFileGroup = {
  path: string;
  language: string;
  hitCount: number;
  topKinds: string[];
  topNames: string[];
};

function diversifyQueryResultsByFile<T extends { path: string }>(results: T[], limit: number): T[] {
  if (results.length <= limit) {
    return results;
  }

  const [top, ...rest] = results;
  if (!top) {
    return [];
  }

  const groups = new Map<string, T[]>();
  const pathOrder: string[] = [];
  for (const result of rest) {
    if (!groups.has(result.path)) {
      groups.set(result.path, []);
      pathOrder.push(result.path);
    }
    groups.get(result.path)?.push(result);
  }

  const diversified: T[] = [top];
  while (diversified.length < limit) {
    let madeProgress = false;
    for (const path of pathOrder) {
      const bucket = groups.get(path);
      const next = bucket?.shift();
      if (!next) {
        continue;
      }
      diversified.push(next);
      madeProgress = true;
      if (diversified.length >= limit) {
        break;
      }
    }
    if (!madeProgress) {
      break;
    }
  }

  return diversified.slice(0, limit);
}

function buildQueryFileGroups(results: Array<{ path: string; language: string; kind: string; name: string }>): QueryFileGroup[] {
  const groups = new Map<string, QueryFileGroup>();

  for (const result of results) {
    const existing = groups.get(result.path);
    if (existing) {
      existing.hitCount += 1;
      if (!existing.topKinds.includes(result.kind) && existing.topKinds.length < 3) {
        existing.topKinds.push(result.kind);
      }
      if (!existing.topNames.includes(result.name) && existing.topNames.length < 3) {
        existing.topNames.push(result.name);
      }
      continue;
    }

    groups.set(result.path, {
      path: result.path,
      language: result.language,
      hitCount: 1,
      topKinds: [result.kind],
      topNames: [result.name]
    });
  }

  return [...groups.values()];
}

export async function runQuery(
  root: string,
  rawQuery: string,
  limit: number,
  kinds: string[] = [],
  intent: QueryIntentOptions = {},
  options: { compact?: boolean } = {}
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
  const candidateLimit = Math.max(limit * 3, limit + 4);
  const search = searchSymbolsWithDiagnostics(db, ftsQuery, candidateLimit, {
    kinds,
    rawQuery: normalizedQuery,
    embeddingProvider: activeEmbeddings?.provider ?? null,
    embeddingModel: activeEmbeddings?.model ?? null,
    queryEmbedding,
    ...intent
  });
  const results = diversifyQueryResultsByFile(search.results, limit);
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));
  const resultQuality = summarizeRetrievalQuality(results);
  const fileGroups = buildQueryFileGroups(results);

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
      fileGroups: "fileGroups summarize how the returned symbol hits cluster by file so consumers can see repeated-file concentration without inferring it manually from results.",
      graphDiagnostics: "graphDiagnostics are index-bounded structural signals for each result, such as no known inbound references, test-only inbound references, same-file-only connectivity, disconnected-from-indexed-graph, root-like status, and possible-orphan candidacy. They are not dead-code claims.",
      retrievalChannels: ["lexical", "concept_path", "semantic"],
      hybridContribution: "lexical_only means no semantic candidate was retained; semantic_only means the result came from embeddings without lexical admission; semantic_assisted means both channels admitted the result",
      graphSignals: "same_file_cluster, imports_candidate, imported_by_candidate, uses_candidate, used_by_candidate, and root_candidate reflect one-hop graph-aware reranking signals from the current candidate neighborhood"
      }
    }),
    resultQuality,
    fileGroups,
    results
  };

  if (config?.impactTracking?.enabled) {
    recordImpactTrackingEvent(db, {
      command: "query",
      timestamp: new Date().toISOString(),
      payloadChars: JSON.stringify(payload).length,
      compact: options.compact === true,
      retrievalMode: queryEmbedding ? "hybrid" : "lexical",
      resultQualityLevel: resultQuality.level,
      noStrongMatch: resultQuality.noStrongMatch,
      staleIndex: indexFreshness.stale
    });
  }

  db.close();
  console.log(JSON.stringify(payload, null, 2));
}
