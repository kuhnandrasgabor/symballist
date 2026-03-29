import { ensureInitialized } from "../fs.ts";

export async function runInit(root: string): Promise<void> {
  await ensureInitialized(root);
  console.log(`Initialized symballist in ${root}`);
}
