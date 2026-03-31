import {
  getBestSymbolByName,
  getGraphTraversalForSymbol,
  getIndexedFiles,
  getRelationsForSymbol,
  getSymbolById,
  openDatabase
} from "../db.ts";
import { detectIndexFreshness } from "../freshness.ts";

export async function runGraph(
  root: string,
  rawId: string,
  rawName?: string,
  options: { compact?: boolean } = {}
): Promise<void> {
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
  db.close();

  if (!symbol) {
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

  console.log(JSON.stringify(payload, null, 2));
}
