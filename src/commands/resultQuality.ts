import type { QueryResult, RetrievalQualitySummary } from "../types.ts";

function isStrongMatch(result: QueryResult): boolean {
  return result.confidence === "exact"
    || (result.confidence === "strong" && result.retrievalTrustLevel !== "low");
}

function isSemanticallyConfirmedTopResult(result: QueryResult): boolean {
  return result.confidence === "related"
    && result.retrievalTrustLevel === "high"
    && result.hybridContribution !== "lexical_only"
    && (result.semanticSimilarity ?? 0) >= 0.7
    && (result.scoreMarginFromTop ?? 0) >= 0.15;
}

export function summarizeRetrievalQuality(results: QueryResult[]): RetrievalQualitySummary {
  const top = results[0] ?? null;
  const strongMatchCount = results.filter(isStrongMatch).length;

  if (!top) {
    return {
      level: "none",
      reason: "no_results",
      noStrongMatch: true,
      strongMatchCount: 0,
      resultCount: 0,
      topResultConfidence: null,
      topResultRetrievalTrustLevel: null
    };
  }

  if (isStrongMatch(top)) {
    return {
      level: "strong",
      reason: "top_result_strong",
      noStrongMatch: false,
      strongMatchCount,
      resultCount: results.length,
      topResultConfidence: top.confidence,
      topResultRetrievalTrustLevel: top.retrievalTrustLevel
    };
  }

  if (isSemanticallyConfirmedTopResult(top)) {
    return {
      level: "strong",
      reason: "top_result_semantically_confirmed",
      noStrongMatch: false,
      strongMatchCount,
      resultCount: results.length,
      topResultConfidence: top.confidence,
      topResultRetrievalTrustLevel: top.retrievalTrustLevel
    };
  }

  if (strongMatchCount > 0) {
    return {
      level: "moderate",
      reason: "strong_match_present",
      noStrongMatch: false,
      strongMatchCount,
      resultCount: results.length,
      topResultConfidence: top.confidence,
      topResultRetrievalTrustLevel: top.retrievalTrustLevel
    };
  }

  if ((top.confidence === "related" && top.retrievalTrustLevel !== "low")
    || top.confidence === "strong") {
    return {
      level: "moderate",
      reason: "related_but_actionable",
      noStrongMatch: true,
      strongMatchCount: 0,
      resultCount: results.length,
      topResultConfidence: top.confidence,
      topResultRetrievalTrustLevel: top.retrievalTrustLevel
    };
  }

  return {
    level: "weak",
    reason: "only_weak_matches",
    noStrongMatch: true,
    strongMatchCount: 0,
    resultCount: results.length,
    topResultConfidence: top.confidence,
    topResultRetrievalTrustLevel: top.retrievalTrustLevel
  };
}
