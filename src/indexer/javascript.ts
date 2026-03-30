import { extname } from "node:path";
import Parser from "tree-sitter";
import Javascript from "tree-sitter-javascript";
import Typescript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
import type { SymbolRecord } from "../types.ts";

const javascriptParser = new Parser();
javascriptParser.setLanguage(Javascript);

const typescriptParser = new Parser();
typescriptParser.setLanguage(Typescript.typescript);

const tsxParser = new Parser();
tsxParser.setLanguage(Typescript.tsx);

const MAX_TREE_SITTER_SOURCE_CHARS = 32000;

function nodeText(source: string, node: SyntaxNode | null): string {
  if (!node) {
    return "";
  }
  return source.slice(node.startIndex, node.endIndex);
}

function sliceBody(source: string, start: number, end: number): string {
  const preview = source.slice(start, Math.min(end, start + 320)).trim();
  return preview.length > 0 ? preview : source.slice(0, 320).trim();
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

function fallbackRecord(path: string, language: "javascript" | "typescript", source: string, reason: string): SymbolRecord[] {
  return [
    {
      path,
      language,
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

function parserForTypeScriptPath(path: string): Parser {
  return extname(path).toLowerCase() === ".tsx" ? tsxParser : typescriptParser;
}

function identifierText(source: string, node: SyntaxNode | null): string {
  return nodeText(source, node).trim();
}

function enclosingClassName(source: string, node: SyntaxNode): string | null {
  let current: SyntaxNode | null = node.parent;
  while (current) {
    if (current.type === "class_declaration" || current.type === "class") {
      const nameNode = current.childForFieldName("name") ?? current.namedChildren.find((child) => child.type === "identifier" || child.type === "type_identifier") ?? null;
      const name = identifierText(source, nameNode);
      if (name) {
        return name;
      }
    }
    current = current.parent;
  }
  return null;
}

function extractVariableFunctionSymbol(
  path: string,
  language: "javascript" | "typescript",
  source: string,
  node: SyntaxNode
): SymbolRecord | null {
  if (node.type !== "variable_declarator") {
    return null;
  }

  const nameNode = node.childForFieldName("name") ?? node.namedChildren[0] ?? null;
  const valueNode = node.childForFieldName("value") ?? node.namedChildren[1] ?? null;
  const name = identifierText(source, nameNode);
  if (!name || !valueNode) {
    return null;
  }

  if (valueNode.type !== "arrow_function" && valueNode.type !== "function_expression") {
    return null;
  }

  const parametersNode = valueNode.childForFieldName("parameters") ?? valueNode.namedChildren.find((child) => child.type === "formal_parameters") ?? null;
  const returnTypeNode = valueNode.childForFieldName("return_type") ?? valueNode.namedChildren.find((child) => child.type === "type_annotation") ?? null;
  const returnSuffix = returnTypeNode ? nodeText(source, returnTypeNode).trim() : "";

  return {
    path,
    language,
    kind: "function",
    name,
    signature: `${name}${nodeText(source, parametersNode).trim()}${returnSuffix}`,
    body: sliceBody(source, node.startIndex, node.endIndex),
    doc: null,
    fallback: false,
    ...nodeSpan(node)
  };
}

function extractMethodSymbol(
  path: string,
  language: "javascript" | "typescript",
  source: string,
  node: SyntaxNode
): SymbolRecord | null {
  if (node.type !== "method_definition") {
    return null;
  }

  const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "property_identifier" || child.type === "identifier" || child.type === "private_property_identifier") ?? null;
  const parametersNode = node.childForFieldName("parameters") ?? node.namedChildren.find((child) => child.type === "formal_parameters") ?? null;
  const returnTypeNode = node.childForFieldName("return_type") ?? node.namedChildren.find((child) => child.type === "type_annotation") ?? null;
  const name = identifierText(source, nameNode);
  if (!name) {
    return null;
  }

  const className = enclosingClassName(source, node);
  const returnSuffix = returnTypeNode ? nodeText(source, returnTypeNode).trim() : "";

  return {
    path,
    language,
    kind: "method",
    name,
    signature: `${className ? `${className}.` : ""}${name}${nodeText(source, parametersNode).trim()}${returnSuffix}`,
    body: sliceBody(source, node.startIndex, node.endIndex),
    doc: null,
    fallback: false,
    ...nodeSpan(node)
  };
}

function extractScriptSymbols(path: string, language: "javascript" | "typescript", source: string, parser: Parser): SymbolRecord[] {
  if (source.length > MAX_TREE_SITTER_SOURCE_CHARS) {
    return fallbackRecord(
      path,
      language,
      source,
      `Fallback record created because ${language} source exceeded the safe tree-sitter size limit (${MAX_TREE_SITTER_SOURCE_CHARS} chars) on this runtime.`
    );
  }

  let tree;
  try {
    tree = parser.parse(source);
  } catch (error) {
    return fallbackRecord(path, language, source, `Fallback record created because ${language} parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const symbols: SymbolRecord[] = [];

  visit(tree.rootNode, (node) => {
    if (node.type === "class_declaration" || node.type === "class") {
      const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "identifier" || child.type === "type_identifier") ?? null;
      const heritageNode = node.childForFieldName("heritage") ?? node.namedChildren.find((child) => child.type === "class_heritage") ?? null;
      const name = identifierText(source, nameNode);
      if (!name) {
        return;
      }

      symbols.push({
        path,
        language,
        kind: "class",
        name,
        signature: `class ${name}${nodeText(source, heritageNode).trim()}`,
        body: sliceBody(source, node.startIndex, node.endIndex),
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
      return;
    }

    if (node.type === "function_declaration") {
      const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "identifier") ?? null;
      const parametersNode = node.childForFieldName("parameters") ?? node.namedChildren.find((child) => child.type === "formal_parameters") ?? null;
      const returnTypeNode = node.childForFieldName("return_type") ?? node.namedChildren.find((child) => child.type === "type_annotation") ?? null;
      const name = identifierText(source, nameNode);
      if (!name) {
        return;
      }

      const returnSuffix = returnTypeNode ? nodeText(source, returnTypeNode).trim() : "";
      symbols.push({
        path,
        language,
        kind: "function",
        name,
        signature: `${name}${nodeText(source, parametersNode).trim()}${returnSuffix}`,
        body: sliceBody(source, node.startIndex, node.endIndex),
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
      return;
    }

    if (language === "typescript" && node.type === "interface_declaration") {
      const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "type_identifier") ?? null;
      const name = identifierText(source, nameNode);
      if (!name) {
        return;
      }

      symbols.push({
        path,
        language,
        kind: "interface",
        name,
        signature: `interface ${name}`,
        body: sliceBody(source, node.startIndex, node.endIndex),
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
      return;
    }

    if (language === "typescript" && node.type === "type_alias_declaration") {
      const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "type_identifier") ?? null;
      const name = identifierText(source, nameNode);
      if (!name) {
        return;
      }

      symbols.push({
        path,
        language,
        kind: "type",
        name,
        signature: `type ${name}`,
        body: sliceBody(source, node.startIndex, node.endIndex),
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
      return;
    }

    if (language === "typescript" && node.type === "enum_declaration") {
      const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "identifier" || child.type === "type_identifier") ?? null;
      const name = identifierText(source, nameNode);
      if (!name) {
        return;
      }

      symbols.push({
        path,
        language,
        kind: "enum",
        name,
        signature: `enum ${name}`,
        body: sliceBody(source, node.startIndex, node.endIndex),
        doc: null,
        fallback: false,
        ...nodeSpan(node)
      });
      return;
    }

    const variableFunction = extractVariableFunctionSymbol(path, language, source, node);
    if (variableFunction) {
      symbols.push(variableFunction);
      return;
    }

    const method = extractMethodSymbol(path, language, source, node);
    if (method) {
      symbols.push(method);
    }
  });

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, language, source, `Fallback record created because no ${language} symbols were extracted.`);
}

export function extractJavaScriptSymbols(path: string, source: string): SymbolRecord[] {
  return extractScriptSymbols(path, "javascript", source, javascriptParser);
}

export function extractTypeScriptSymbols(path: string, source: string): SymbolRecord[] {
  return extractScriptSymbols(path, "typescript", source, parserForTypeScriptPath(path));
}
