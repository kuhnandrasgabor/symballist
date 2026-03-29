import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import type { SymbolRecord } from "../types.ts";

const parser = new Parser();
parser.setLanguage(Python);
const MAX_TREE_SITTER_SOURCE_CHARS = 32000;

function sliceBody(source: string, start: number, end: number): string {
  const preview = source.slice(start, Math.min(end, start + 320)).trim();
  return preview.length > 0 ? preview : source.slice(0, 320).trim();
}

function nodeText(source: string, node: SyntaxNode | null): string {
  if (!node) {
    return "";
  }
  return source.slice(node.startIndex, node.endIndex);
}

function visit(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (const child of node.namedChildren) {
    visit(child, callback);
  }
}

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

function nodeSpan(node: SyntaxNode): Pick<SymbolRecord, "startLine" | "startColumn" | "endLine" | "endColumn"> {
  return {
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column + 1,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column + 1
  };
}

function fallbackRecord(path: string, source: string, reason: string): SymbolRecord[] {
  return [
    {
      path,
      language: "python",
      kind: "file",
      name: path,
      signature: null,
      body: source.slice(0, 500).trim(),
      doc: reason,
      fallback: true,
      ...fullFileSpan(source)
    }
  ];
}

export function extractPythonSymbols(path: string, source: string): SymbolRecord[] {
  if (source.length > MAX_TREE_SITTER_SOURCE_CHARS) {
    return fallbackRecord(
      path,
      source,
      `Fallback record created because Python source exceeded the safe tree-sitter size limit (${MAX_TREE_SITTER_SOURCE_CHARS} chars) on this runtime.`
    );
  }

  const symbols: SymbolRecord[] = [];
  let tree;
  try {
    tree = parser.parse(source);
  } catch (error) {
    return fallbackRecord(path, source, `Fallback record created because Python parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  visit(tree.rootNode, (node) => {
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      const statement = nodeText(source, node).trim();
      symbols.push({
        path,
        language: "python",
        kind: "import",
        name: statement,
        signature: statement,
        body: statement,
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
      return;
    }

    if (node.type === "class_definition") {
      const nameNode = node.childForFieldName("name");
      const superclassesNode = node.childForFieldName("superclasses");
      const name = nodeText(source, nameNode).trim();
      if (!name) {
        return;
      }
      const signature = `class ${name}${nodeText(source, superclassesNode).trim()}`;
      symbols.push({
        path,
        language: "python",
        kind: "class",
        name,
        signature,
        body: sliceBody(source, node.startIndex, node.endIndex),
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
      return;
    }

    if (node.type === "function_definition") {
      const nameNode = node.childForFieldName("name");
      const parametersNode = node.childForFieldName("parameters");
      const name = nodeText(source, nameNode).trim();
      if (!name) {
        return;
      }
      const signature = `${name}${nodeText(source, parametersNode).trim()}`;
      symbols.push({
        path,
        language: "python",
        kind: "function",
        name,
        signature,
        body: sliceBody(source, node.startIndex, node.endIndex),
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
    }
  });

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, source, "Fallback record created because no Python symbols were extracted.");
}
