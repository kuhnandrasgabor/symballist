import { getBestSymbolByName, getIndexedFiles, getRelatedSymbolsForSymbol, getRelationsForSymbol, getSymbolById, openDatabase } from "../db.ts";
import { detectIndexFreshness } from "../freshness.ts";

export async function runShow(root: string, rawId: string, rawName?: string): Promise<void> {
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
  db.close();

  if (!symbol) {
    if (rawName?.trim()) {
      throw new Error(`No indexed symbol found for name ${rawName}.`);
    }
    throw new Error(`No indexed symbol found for id ${rawId}.`);
  }

  console.log(JSON.stringify({
    indexFreshness,
    symbol,
    relations,
    related
  }, null, 2));
}
