import { getSymbolById, openDatabase } from "../db.ts";

export async function runShow(root: string, rawId: string): Promise<void> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("A positive symbol id is required.");
  }

  const db = await openDatabase(root);
  const symbol = getSymbolById(db, id);
  db.close();

  if (!symbol) {
    throw new Error(`No indexed symbol found for id ${id}.`);
  }

  console.log(JSON.stringify(symbol, null, 2));
}
