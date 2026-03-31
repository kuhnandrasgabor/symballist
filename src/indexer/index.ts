import { extractCssSymbols, extractDockerfileSymbols, extractShellSymbols, extractYamlSymbols } from "./configops.ts";
import { extractHtmlSymbols } from "./html.ts";
import { extractJavaScriptSymbols, extractTypeScriptSymbols } from "./javascript.ts";
import { extractMarkdownSymbols } from "./markdown.ts";
import { extractPythonSymbols } from "./python.ts";
import type { SupportedLanguage, SymbolRecord } from "../types.ts";

type ExtractContext = {
  availablePaths?: Set<string>;
};

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

export function extractSymbols(path: string, language: SupportedLanguage, source: string, context: ExtractContext = {}): SymbolRecord[] {
  switch (language) {
    case "python":
      return extractPythonSymbols(path, source, context.availablePaths);
    case "html":
      return extractHtmlSymbols(path, source);
    case "markdown":
      return extractMarkdownSymbols(path, source);
    case "javascript":
      return extractJavaScriptSymbols(path, source, context.availablePaths);
    case "typescript":
      return extractTypeScriptSymbols(path, source, context.availablePaths);
    case "yaml":
      return extractYamlSymbols(path, source);
    case "shell":
      return extractShellSymbols(path, source);
    case "dockerfile":
      return extractDockerfileSymbols(path, source);
    case "css":
      return extractCssSymbols(path, source);
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
