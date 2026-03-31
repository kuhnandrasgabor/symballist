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

export async function runGraph(
  root: string,
  rawId: string,
  rawName?: string,
  options: { compact?: boolean } = {}
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

  const payload = {
    indexFreshness,
    ...(options.compact === true ? {} : {
      graphSemantics: {
        traversals: "imports and uses are outbound from the selected symbol; imported_by and used_by are inbound graph neighbors; contained_in resolves the nearest owning container when present.",
        caveat: "Traversal is bounded by the currently indexed lightweight graph and is intended for navigation, not exhaustiveness."
      }
    }),
    symbol,
    relations,
    graph: {
      imports: traversals.filter((entry) => entry.traversal === "imports"),
      uses: traversals.filter((entry) => entry.traversal === "uses"),
      importedBy: traversals.filter((entry) => entry.traversal === "imported_by"),
      usedBy: traversals.filter((entry) => entry.traversal === "used_by"),
      containedIn: traversals.filter((entry) => entry.traversal === "contained_in"),
      totalEdges: traversals.length
    }
  };

  if (config?.impactTracking?.enabled) {
    recordImpactTrackingEvent(db, {
      command: "graph",
      timestamp: new Date().toISOString(),
      payloadChars: JSON.stringify(payload).length,
      compact: options.compact === true,
      selectedResult: true,
      graphEdgesViewed: traversals.length,
      staleIndex: indexFreshness.stale
    });
  }

  db.close();
  console.log(JSON.stringify(payload, null, 2));
}
