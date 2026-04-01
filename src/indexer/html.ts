import Parser from "tree-sitter";
import Html from "tree-sitter-html";
import type { SyntaxNode } from "tree-sitter";
import type { SymbolRecord } from "../types.ts";
import { MAX_TREE_SITTER_SOURCE_CHARS, oversizedFallbackReason } from "./oversized.ts";

const parser = new Parser();
parser.setLanguage(Html);

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
      language: "html",
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

export function extractHtmlSymbols(path: string, source: string): SymbolRecord[] {
  if (source.length > MAX_TREE_SITTER_SOURCE_CHARS) {
    return fallbackRecord(
      path,
      source,
      oversizedFallbackReason("HTML")
    );
  }

  const symbols: SymbolRecord[] = [];
  let tree;
  try {
    tree = parser.parse(source);
  } catch (error) {
    return fallbackRecord(path, source, `Fallback record created because HTML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  visit(tree.rootNode, (node) => {
    if (node.type !== "element") {
      return;
    }

    const startTag = node.namedChildren.find((child) => child.type === "start_tag") ?? null;
    const endTag = node.namedChildren.find((child) => child.type === "end_tag") ?? null;
    const tagNameNode = startTag?.namedChildren.find((child) => child.type === "tag_name") ?? null;
    const tagName = nodeText(source, tagNameNode).trim().toLowerCase();

    if (tagName === "title") {
      const textNode = node.namedChildren.find((child) => child.type === "text") ?? null;
      const title = nodeText(source, textNode).trim();
      if (title) {
        symbols.push({
          path,
          language: "html",
          kind: "title",
          name: title,
          signature: "<title>",
          body: nodeText(source, node),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        });
      }
    }

    if (!startTag) {
      return;
    }

    for (const child of startTag.namedChildren) {
      if (child.type !== "attribute") {
        continue;
      }
      const nameNode = child.namedChildren.find((grandchild) => grandchild.type === "attribute_name") ?? null;
      const quotedValueNode = child.namedChildren.find((grandchild) => grandchild.type === "quoted_attribute_value") ?? null;
      const valueNode = quotedValueNode?.namedChildren.find((grandchild) => grandchild.type === "attribute_value") ?? quotedValueNode;
      const attrName = nodeText(source, nameNode).trim().toLowerCase();
      const rawValue = nodeText(source, valueNode).trim();
      const normalizedValue = rawValue.replace(/^['"]|['"]$/g, "");
      if (attrName === "id" && normalizedValue) {
        symbols.push({
          path,
          language: "html",
          kind: "element",
          name: normalizedValue,
          signature: nodeText(source, startTag) || `<${tagName}>`,
          body: nodeText(source, node) || nodeText(source, startTag) + nodeText(source, endTag),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        });
      }
    }
  });

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, source, "Fallback record created because no HTML symbols were extracted.");
}
