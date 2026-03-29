import { openDatabase } from "../db.ts";
import { ensureInitialized } from "../fs.ts";

export async function runInit(root: string): Promise<void> {
  await ensureInitialized(root);
  const db = await openDatabase(root);
  db.close();
  console.log(`Initialized symballist in ${root}`);
}
