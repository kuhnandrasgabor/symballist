import type { SupportedLanguage } from "../types.ts";

export const MAX_TREE_SITTER_SOURCE_CHARS = 32000;

export function oversizedRecoveryDoc(language: SupportedLanguage): string {
  return `Recovered from oversized ${language} file via lightweight top-level scan.`;
}

export function oversizedFallbackReason(language: string): string {
  return `Fallback record created because ${language} source exceeded the safe tree-sitter size limit (${MAX_TREE_SITTER_SOURCE_CHARS} chars) on this runtime.`;
}

export function isOversizedRecoveryDoc(doc: string | null): boolean {
  return (doc ?? "").startsWith("Recovered from oversized ");
}
