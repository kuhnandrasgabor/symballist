import type { SymbolRecord } from "../types.ts";

const TITLE_RE = /<title>([\s\S]*?)<\/title>/i;
const ID_RE = /<([A-Za-z][A-Za-z0-9:-]*)[^>]*\sid=["']([^"']+)["'][^>]*>/g;

export function extractHtmlSymbols(path: string, source: string): SymbolRecord[] {
  const symbols: SymbolRecord[] = [];
  const title = source.match(TITLE_RE);

  if (title) {
    symbols.push({
      path,
      language: "html",
      kind: "title",
      name: title[1].trim(),
      signature: "<title>",
      body: title[0],
      doc: null,
      fallback: false
    });
  }

  for (const match of source.matchAll(ID_RE)) {
    const tag = match[1];
    const id = match[2];
    symbols.push({
      path,
      language: "html",
      kind: "element",
      name: id,
      signature: `<${tag} id="${id}">`,
      body: match[0],
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
      language: "html",
      kind: "file",
      name: path,
      signature: null,
      body: source.slice(0, 500).trim(),
      doc: "Fallback record created because no HTML symbols were extracted.",
      fallback: true
    }
  ];
}
