import { extractHtmlSymbols } from "./html.ts";
import { extractPythonSymbols } from "./python.ts";
import type { SupportedLanguage, SymbolRecord } from "../types.ts";

function fullFileSpan(source: string): Pick<SymbolRecord, "startLine" | "startColumn" | "endLine" | "endColumn"> {
  const lines = source.split(/\r?\n/);
  const endLine = Math.max(lines.length, 1);
  const endColumn = (lines.at(-1)?.length ?? 0) + 1;
  return {
    startLine: 1,
    startColumn: 1,
    endLine,
    endColumn
  };
}

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
          fallback: true,
          ...fullFileSpan(source)
        }
      ];
  }
}
