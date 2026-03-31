import {
  getBestSymbolByName,
  getGraphTraversalForSymbol,
  getIndexedFiles,
  getRelationsForSymbol,
  getSymbolById,
  openDatabase,
  recordImpactTrackingEvent
} from "../db.ts";
import { detectIndexFreshness } from "../freshness.ts";
import { readConfig } from "../fs.ts";
import { summarizeBody } from "./show.ts";
import type { GraphTraversalEntry, SymbolDetails } from "../types.ts";

function compactSymbol(symbol: SymbolDetails): Omit<SymbolDetails, "body" | "doc" | "graphDiagnostics"> {
  return {
    id: symbol.id,
    path: symbol.path,
    file: symbol.file,
    location: symbol.location,
    language: symbol.language,
    kind: symbol.kind,
    name: symbol.name,
    signature: symbol.signature,
    extraction: symbol.extraction,
    trustLevel: symbol.trustLevel,
    fallback: symbol.fallback,
    startLine: symbol.startLine,
    startColumn: symbol.startColumn,
    endLine: symbol.endLine,
    endColumn: symbol.endColumn
  };
}

function compactTraversalEntry(entry: GraphTraversalEntry): Omit<GraphTraversalEntry, "symbol"> & {
  symbol: ReturnType<typeof compactSymbol>;
} {
  return {
    traversal: entry.traversal,
    relation: entry.relation,
    symbol: compactSymbol(entry.symbol)
  };
}

function presentTraversalEntry(
  entry: GraphTraversalEntry,
  options: { compact?: boolean; full?: boolean }
): GraphTraversalEntry | (Omit<GraphTraversalEntry, "symbol"> & {
  symbol: ReturnType<typeof compactSymbol>;
}) | (GraphTraversalEntry & {
  bodyPresentation: ReturnType<typeof summarizeBody>["presentation"];
}) {
  if (options.compact === true) {
    return compactTraversalEntry(entry);
  }

  const body = summarizeBody(entry.symbol.body, options.full === true);
  return {
    ...entry,
    symbol: {
      ...entry.symbol,
      body: body.body
    },
    bodyPresentation: body.presentation
  };
}

export async function runGraph(
  root: string,
  rawId: string,
  rawName?: string,
  options: { compact?: boolean; full?: boolean } = {}
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
  const traversals = symbol ? getGraphTraversalForSymbol(db, symbol, 20) : [];
  const relations = symbol ? getRelationsForSymbol(db, symbol) : [];
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));

  if (!symbol) {
    db.close();
    if (rawName?.trim()) {
      throw new Error(`No indexed symbol found for name ${rawName}.`);
    }
    throw new Error(`No indexed symbol found for id ${rawId}.`);
  }

  const groupedGraph = {
    imports: traversals.filter((entry) => entry.traversal === "imports"),
    uses: traversals.filter((entry) => entry.traversal === "uses"),
    importedBy: traversals.filter((entry) => entry.traversal === "imported_by"),
    usedBy: traversals.filter((entry) => entry.traversal === "used_by"),
    containedIn: traversals.filter((entry) => entry.traversal === "contained_in")
  };
  const presentedSymbol = options.compact === true ? compactSymbol(symbol) : symbol;
  const presentedGraph = options.compact === true
    ? {
        imports: groupedGraph.imports.map((entry) => presentTraversalEntry(entry, options)),
        uses: groupedGraph.uses.map((entry) => presentTraversalEntry(entry, options)),
        importedBy: groupedGraph.importedBy.map((entry) => presentTraversalEntry(entry, options)),
        usedBy: groupedGraph.usedBy.map((entry) => presentTraversalEntry(entry, options)),
        containedIn: groupedGraph.containedIn.map((entry) => presentTraversalEntry(entry, options))
      }
    : {
        imports: groupedGraph.imports.map((entry) => presentTraversalEntry(entry, options)),
        uses: groupedGraph.uses.map((entry) => presentTraversalEntry(entry, options)),
        importedBy: groupedGraph.importedBy.map((entry) => presentTraversalEntry(entry, options)),
        usedBy: groupedGraph.usedBy.map((entry) => presentTraversalEntry(entry, options)),
        containedIn: groupedGraph.containedIn.map((entry) => presentTraversalEntry(entry, options))
      };

  const payload = {
    indexFreshness,
    ...(options.compact === true ? {} : {
      graphSemantics: {
        traversals: "imports and uses are outbound from the selected symbol; imported_by and used_by are inbound graph neighbors; contained_in resolves the nearest owning container when present.",
        neighborBodies: "Neighbor bodies summarize by default in graph output; rerun the same graph command with --full to expand neighbor bodies inline.",
        graphDiagnostics: "knownInboundReferences and knownOutboundReferences count unique connected paths in the indexed graph; the grouped traversal view may still show multiple relation entries that point at the same target.",
        caveat: "Traversal is bounded by the currently indexed lightweight graph and is intended for navigation, not exhaustiveness."
      }
    }),
    symbol: presentedSymbol,
    relations,
    graph: presentedGraph,
    graphSummary: {
      totalEdges: traversals.length,
      neighborBodyMode: options.compact === true ? "compact" : options.full === true ? "full" : "summary"
    }
  };

  if (config?.impactTracking?.enabled) {
    recordImpactTrackingEvent(db, {
      command: "graph",
      timestamp: new Date().toISOString(),
      payloadChars: JSON.stringify(payload).length,
      compact: options.compact === true,
      fullRequested: options.full === true,
      selectedResult: true,
      graphEdgesViewed: traversals.length,
      staleIndex: indexFreshness.stale
    });
  }

  db.close();
  console.log(JSON.stringify(payload, null, 2));
}
