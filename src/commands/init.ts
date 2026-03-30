import { ensureInitialized } from "../fs.ts";
import type { SetupType } from "../config.ts";
import { readConfig } from "../fs.ts";
import { getShellGuidance } from "../shell.ts";

export async function runInit(root: string, setupType?: SetupType): Promise<void> {
  await ensureInitialized(root, setupType);
  const config = await readConfig(root);
  const shellGuidance = getShellGuidance(root);
  console.log(`Initialized symballist in ${root}`);
  console.log(`Setup type: ${config?.setupType ?? "hybrid"}`);
  console.log(`From the repo root, use this entrypoint for ${shellGuidance.detectedShell}: ${shellGuidance.recommendedEntrypoint}`);
  console.log(`If you already ran bun link from this checkout, you can also just run: ${shellGuidance.linkedEntrypoint}`);
  console.log(`Quick start from the repo root: ${shellGuidance.recommendedCommands.status}`);
}
