import { ensureInitialized } from "../fs.ts";
import type { SetupType } from "../config.ts";

export async function runInit(root: string, setupType?: SetupType): Promise<void> {
  await ensureInitialized(root, setupType);
  console.log(`Initialized symballist in ${root}`);
}
