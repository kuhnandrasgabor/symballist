import { initializeWithLanguageSelection } from "../fs.ts";
import type { SetupType, SupportedLanguage } from "../config.ts";
import { getShellGuidance } from "../shell.ts";

export async function runInit(
  root: string,
  setupType?: SetupType,
  options: { languages?: SupportedLanguage[]; autoDetectLanguages?: boolean } = {}
): Promise<void> {
  const config = await initializeWithLanguageSelection(root, {
    setupType,
    languages: options.languages,
    autoDetectLanguages: options.autoDetectLanguages
  });
  const shellGuidance = getShellGuidance(root);
  console.log(`Initialized symballist in ${root}`);
  console.log(`Setup type: ${config?.setupType ?? "hybrid"}`);
  console.log(`Enabled languages: ${(config?.languages ?? []).join(", ")}`);
  console.log(`From the repo root, use this entrypoint for ${shellGuidance.detectedShell}: ${shellGuidance.recommendedEntrypoint}`);
  console.log(`If you already ran bun link from this checkout, you can also just run: ${shellGuidance.linkedEntrypoint}`);
  console.log(`Quick start from the repo root: ${shellGuidance.recommendedCommands.status}`);
}
