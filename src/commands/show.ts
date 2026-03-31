import { getBestSymbolByName, getIndexedFiles, getRelatedSymbolsForSymbol, getRelationsForSymbol, getSymbolById, openDatabase, recordImpactTrackingEvent } from "../db.ts";
import { detectIndexFreshness } from "../freshness.ts";
import { readConfig } from "../fs.ts";

const DEFAULT_SHOW_MAX_LINES = 40;
const DEFAULT_SHOW_MAX_CHARS = 4000;

export type ShowBodyPresentation = {
  mode: "full" | "summary";
  truncated: boolean;
  totalLines: number;
  shownLines: number;
  totalChars: number;
  shownChars: number;
  fullerBodyAvailable: boolean;
  expansionHint: string | null;
};

export function summarizeBody(body: string, full: boolean): { body: string; presentation: ShowBodyPresentation } {
  const lines = body.split(/\r?\n/);
  const totalLines = lines.length;
  const totalChars = body.length;

  if (full || (totalLines <= DEFAULT_SHOW_MAX_LINES && totalChars <= DEFAULT_SHOW_MAX_CHARS)) {
    return {
      body,
      presentation: {
        mode: "full",
        truncated: false,
        totalLines,
        shownLines: totalLines,
        totalChars,
        shownChars: totalChars,
        fullerBodyAvailable: false,
        expansionHint: null
      }
    };
  }

  const limitedLines = lines.slice(0, DEFAULT_SHOW_MAX_LINES);
  let summarizedBody = limitedLines.join("\n");
  if (summarizedBody.length > DEFAULT_SHOW_MAX_CHARS) {
    summarizedBody = `${summarizedBody.slice(0, DEFAULT_SHOW_MAX_CHARS - 3).trimEnd()}...`;
  }
  summarizedBody = `${summarizedBody}\n... [truncated, rerun show with --full for the complete body]`;

  return {
    body: summarizedBody,
    presentation: {
      mode: "summary",
      truncated: true,
      totalLines,
      shownLines: Math.min(limitedLines.length, DEFAULT_SHOW_MAX_LINES),
      totalChars,
      shownChars: summarizedBody.length,
      fullerBodyAvailable: true,
      expansionHint: "Body summarized by default; rerun the same command with --full to return the complete stored body."
    }
  };
}

export async function runShow(
  root: string,
  rawId: string,
  rawName?: string,
  options: { full?: boolean; compact?: boolean } = {}
): Promise<void> {
  const config = await readConfig(root);
  const db = await openDatabase(root);
  let symbol = null;
  if (rawName?.trim()) {
    symbol = getBestSymbolByName(db, rawName);
  } else {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      db.close();
      throw new Error("A positive symbol id or --name <symbol> is required.");
    }
    symbol = getSymbolById(db, id);
  }
  const relations = symbol ? getRelationsForSymbol(db, symbol) : [];
  const related = symbol ? getRelatedSymbolsForSymbol(db, symbol) : [];
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));

  if (!symbol) {
    db.close();
    if (rawName?.trim()) {
      throw new Error(`No indexed symbol found for name ${rawName}.`);
    }
    throw new Error(`No indexed symbol found for id ${rawId}.`);
  }

  const body = summarizeBody(symbol.body, options.full === true);

  const payload = {
    indexFreshness,
    ...(options.compact === true ? {} : {
      trustSemantics: {
        trustLevel: "extraction trust only; show resolves a symbol directly and does not recompute query-time retrieval trust",
        graphDiagnostics: "graphDiagnostics describe what the current index knows structurally about this symbol, including possible-orphan candidacy where relevant. They are bounded by indexed relations and are not dead-code claims."
      }
    }),
    symbol: {
      ...symbol,
      body: body.body
    },
    bodyPresentation: body.presentation,
    relations,
    related
  };

  if (config?.impactTracking?.enabled) {
    recordImpactTrackingEvent(db, {
      command: "show",
      timestamp: new Date().toISOString(),
      payloadChars: JSON.stringify(payload).length,
      compact: options.compact === true,
      bodyMode: body.presentation.mode,
      fullRequested: options.full === true,
      selectedResult: true,
      staleIndex: indexFreshness.stale
    });
  }

  db.close();
  console.log(JSON.stringify(payload, null, 2));
}
