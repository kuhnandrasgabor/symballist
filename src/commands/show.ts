import { getIndexedFiles, getSymbolById, openDatabase } from "../db.ts";
import { detectIndexFreshness } from "../freshness.ts";

export async function runShow(root: string, rawId: string): Promise<void> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("A positive symbol id is required.");
  }

  const db = await openDatabase(root);
  const symbol = getSymbolById(db, id);
  const indexFreshness = await detectIndexFreshness(root, getIndexedFiles(db));
  db.close();

  if (!symbol) {
    throw new Error(`No indexed symbol found for id ${id}.`);
  }

  console.log(JSON.stringify({
    indexFreshness,
    symbol
  }, null, 2));
}
