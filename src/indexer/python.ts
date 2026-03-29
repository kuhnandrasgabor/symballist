import type { SymbolRecord } from "../types.ts";

const IMPORT_RE = /^[ \t]*(?:from\s+([A-Za-z0-9_\.]+)\s+import\s+(.+)|import\s+(.+))$/gm;
const CLASS_RE = /^[ \t]*class\s+([A-Za-z_][A-Za-z0-9_]*)[ \t]*(\([^)]*\))?[ \t]*:/gm;
const FUNCTION_RE = /^[ \t]*(?:async[ \t]+)?def\s+([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(([^)]*)\)[ \t]*(?:->[^:]+)?[ \t]*:/gm;

function sliceBody(source: string, start: number): string {
  const preview = source.slice(start, start + 320).trim();
  return preview.length > 0 ? preview : source.slice(0, 320).trim();
}

export function extractPythonSymbols(path: string, source: string): SymbolRecord[] {
  const symbols: SymbolRecord[] = [];

  for (const match of source.matchAll(IMPORT_RE)) {
    const statement = match[0].trim();
    const name = match[1] ?? match[3] ?? statement;
    symbols.push({
      path,
      language: "python",
      kind: "import",
      name,
      signature: statement,
      body: statement,
      doc: null,
      fallback: false
    });
  }

  for (const match of source.matchAll(CLASS_RE)) {
    const name = match[1];
    const signature = `class ${name}${match[2] ?? ""}`;
    symbols.push({
      path,
      language: "python",
      kind: "class",
      name,
      signature,
      body: sliceBody(source, match.index ?? 0),
      doc: null,
      fallback: false
    });
  }

  for (const match of source.matchAll(FUNCTION_RE)) {
    const name = match[1];
    const params = match[2].trim();
    const signature = `${name}(${params})`;
    symbols.push({
      path,
      language: "python",
      kind: "function",
      name,
      signature,
      body: sliceBody(source, match.index ?? 0),
      doc: null,
      fallback: false
    });
  }

  if (symbols.length > 0) {
    return symbols;
  }

  return [
    {
      path,
      language: "python",
      kind: "file",
      name: path,
      signature: null,
      body: source.slice(0, 500).trim(),
      doc: "Fallback record created because no Python symbols were extracted.",
      fallback: true
    }
  ];
}


