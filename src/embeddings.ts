import type { Database } from "bun:sqlite";
import type { SymballistConfig } from "./config.ts";
import type { SymbolDetails, SymbolRecord } from "./types.ts";
import {
  getEmbeddingSummary,
  replaceSymbolEmbeddings,
  type EmbeddableSymbolRow,
  type EmbeddingSummary
} from "./db.ts";

const MAX_EMBEDDING_TEXT_LINES = 120;
const MAX_EMBEDDING_TEXT_CHARS = 6000;

export type ActiveEmbeddingsConfig = {
  provider: "ollama";
  baseUrl: string;
  model: string;
  dimensions: number | null;
};

export type EmbeddingGenerationResult = {
  provider: "ollama";
  model: string;
  dimensions: number;
  embeddings: number[][];
};

export type EmbeddingAvailability = {
  enabled: boolean;
  configured: boolean;
  available: boolean;
  provider: "ollama" | null;
  model: string | null;
  baseUrl: string | null;
  indexedEmbeddings: number;
  matchedEmbeddings: number;
  reason: string | null;
};

export function getActiveEmbeddingsConfig(config: SymballistConfig | null): ActiveEmbeddingsConfig | null {
  if (!config?.embeddings?.enabled) {
    return null;
  }

  const baseUrl = config.embeddings.baseUrl.trim();
  const model = config.embeddings.model.trim();
  if (!baseUrl || !model) {
    return null;
  }

  return {
    provider: "ollama",
    baseUrl,
    model,
    dimensions: config.embeddings.dimensions ?? null
  };
}

export function getEmbeddingAvailability(
  config: SymballistConfig | null,
  summary: EmbeddingSummary
): EmbeddingAvailability {
  const active = getActiveEmbeddingsConfig(config);
  if (!active) {
    return {
      enabled: Boolean(config?.embeddings?.enabled),
      configured: false,
      available: false,
      provider: config?.embeddings?.provider ?? null,
      model: config?.embeddings?.model ?? null,
      baseUrl: config?.embeddings?.baseUrl ?? null,
      indexedEmbeddings: summary.totalEmbeddings,
      matchedEmbeddings: 0,
      reason: config?.embeddings?.enabled ? "missing_model_or_base_url" : "disabled"
    };
  }

  return {
    enabled: true,
    configured: true,
    available: summary.matchingEmbeddings > 0,
    provider: active.provider,
    model: active.model,
    baseUrl: active.baseUrl,
    indexedEmbeddings: summary.totalEmbeddings,
    matchedEmbeddings: summary.matchingEmbeddings,
    reason: summary.matchingEmbeddings > 0 ? null : "no_indexed_embeddings_for_active_model"
  };
}

export function buildEmbeddingText(symbol: Pick<SymbolRecord, "path" | "kind" | "name" | "signature" | "doc" | "body">): string {
  const parts = [
    symbol.path,
    symbol.kind,
    symbol.name,
    symbol.signature ?? "",
    symbol.doc ?? "",
    symbol.body
  ].map((part) => part.trim()).filter(Boolean);

  const joined = parts.join("\n");
  const lines = joined.split(/\r?\n/).slice(0, MAX_EMBEDDING_TEXT_LINES);
  let truncated = lines.join("\n");
  if (truncated.length > MAX_EMBEDDING_TEXT_CHARS) {
    truncated = truncated.slice(0, MAX_EMBEDDING_TEXT_CHARS);
  }
  return truncated.trimEnd();
}

export async function embedTexts(
  config: ActiveEmbeddingsConfig,
  input: string[]
): Promise<EmbeddingGenerationResult> {
  if (input.length === 0) {
    return {
      provider: config.provider,
      model: config.model,
      dimensions: config.dimensions ?? 0,
      embeddings: []
    };
  }

  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/api/embed`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input,
      stream: false,
      ...(config.dimensions ? { dimensions: config.dimensions } : {})
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${body || response.statusText}`);
  }

  const payload = await response.json() as {
    model?: string;
    embeddings?: number[][];
  };
  const embeddings = payload.embeddings ?? [];
  const first = embeddings[0] ?? [];

  return {
    provider: config.provider,
    model: payload.model ?? config.model,
    dimensions: first.length,
    embeddings
  };
}

export async function updateEmbeddingsForSymbols(
  db: Database,
  config: ActiveEmbeddingsConfig,
  symbols: EmbeddableSymbolRow[]
): Promise<number> {
  if (symbols.length === 0) {
    return 0;
  }

  const result = await embedTexts(config, symbols.map((symbol) => buildEmbeddingText(symbol)));
  replaceSymbolEmbeddings(db, symbols.map((symbol, index) => ({
    symbolId: symbol.id,
    provider: result.provider,
    model: result.model,
    dimensions: result.dimensions,
    embedding: result.embeddings[index] ?? []
  })));

  return result.embeddings.length;
}

export function cosineSimilarity(left: number[], right: number[]): number {
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

export function summarizeEmbeddingSupport(
  db: Database,
  config: SymballistConfig | null
): EmbeddingAvailability {
  const active = getActiveEmbeddingsConfig(config);
  const summary = getEmbeddingSummary(db, active?.provider ?? null, active?.model ?? null);
  return getEmbeddingAvailability(config, summary);
}

export function symbolTextFromDetails(symbol: SymbolDetails): string {
  return buildEmbeddingText(symbol);
}
