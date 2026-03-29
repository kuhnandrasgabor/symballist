import { extractHtmlSymbols } from "./html.ts";
import { extractPythonSymbols } from "./python.ts";
import type { SupportedLanguage, SymbolRecord } from "../types.ts";

export function extractSymbols(path: string, language: SupportedLanguage, source: string): SymbolRecord[] {
  switch (language) {
    case "python":
      return extractPythonSymbols(path, source);
    case "html":
      return extractHtmlSymbols(path, source);
    default:
      return [
        {
          path,
          language: "text",
          kind: "file",
          name: path,
          signature: null,
          body: source.slice(0, 500).trim(),
          doc: "Fallback text record.",
          fallback: true
        }
      ];
  }
}
