import { dirname, extname, join, normalize } from "node:path";
import Parser from "tree-sitter";
import Javascript from "tree-sitter-javascript";
import Typescript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
import type { RelationDetails, SymbolRecord } from "../types.ts";

const javascriptParser = new Parser();
javascriptParser.setLanguage(Javascript);

const typescriptParser = new Parser();
typescriptParser.setLanguage(Typescript.typescript);

const tsxParser = new Parser();
tsxParser.setLanguage(Typescript.tsx);

const MAX_TREE_SITTER_SOURCE_CHARS = 32000;
const SCRIPT_IMPORT_CANDIDATE_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".css"];

type UsageTarget = {
  targetPath: string;
  labelPrefix: string;
};

type ScriptSymbolNode = {
  node: SyntaxNode;
  record: SymbolRecord;
};

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

function resolveScriptImportPath(specifier: string, sourcePath: string, availablePaths: Set<string>): string | null {
  const trimmed = specifier.trim();
  if (!trimmed.startsWith(".")) {
    return null;
  }

  const sourceDir = dirname(sourcePath);
  const baseCandidate = normalize(join(sourceDir, trimmed));
  const candidates = extname(baseCandidate)
    ? [baseCandidate]
    : [
        ...SCRIPT_IMPORT_CANDIDATE_EXTENSIONS.map((extension) => `${baseCandidate}${extension}`),
        ...SCRIPT_IMPORT_CANDIDATE_EXTENSIONS.map((extension) => join(baseCandidate, `index${extension}`))
      ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    if (availablePaths.has(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  return null;
}

function parseImportAliases(statement: string, sourcePath: string, availablePaths: Set<string>): Map<string, UsageTarget> {
  const aliases = new Map<string, UsageTarget>();
  const normalized = statement.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return aliases;
  }

  const fromMatch = normalized.match(/^import\s+(.+?)\s+from\s+["']([^"']+)["'];?$/);
  if (!fromMatch) {
    return aliases;
  }

  const [, clause, specifier] = fromMatch;
  const targetPath = resolveScriptImportPath(specifier, sourcePath, availablePaths);
  if (!targetPath) {
    return aliases;
  }

  const trimmedClause = clause.trim();
  const namespaceMatch = trimmedClause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch?.[1]) {
    aliases.set(namespaceMatch[1], { targetPath, labelPrefix: specifier });
  }

  const namedSectionMatch = trimmedClause.match(/\{([^}]+)\}/);
  if (namedSectionMatch?.[1]) {
    for (const part of namedSectionMatch[1].split(",").map((entry) => entry.trim()).filter(Boolean)) {
      const aliasMatch = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!aliasMatch) {
        continue;
      }
      const importedName = aliasMatch[1];
      const alias = aliasMatch[2] ?? importedName;
      aliases.set(alias, {
        targetPath,
        labelPrefix: `${specifier}.${importedName}`
      });
    }
  }

  const defaultClause = trimmedClause.replace(/\{[^}]+\}/g, "").split(",").map((entry) => entry.trim()).find(Boolean) ?? "";
  if (defaultClause && !defaultClause.includes("* as ")) {
    aliases.set(defaultClause, { targetPath, labelPrefix: specifier });
  }

  return aliases;
}

function extractImportRelations(statement: string, sourcePath: string, availablePaths: Set<string>): RelationDetails[] {
  const normalized = statement.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized.startsWith("import ")) {
    return [];
  }

  const sideEffectMatch = normalized.match(/^import\s+["']([^"']+)["'];?$/);
  if (sideEffectMatch?.[1]) {
    return [{
      kind: "imports",
      targetPath: resolveScriptImportPath(sideEffectMatch[1], sourcePath, availablePaths),
      targetLabel: sideEffectMatch[1]
    }];
  }

  const fromMatch = normalized.match(/^import\s+(.+?)\s+from\s+["']([^"']+)["'];?$/);
  if (!fromMatch) {
    return [];
  }

  const [, clause, specifier] = fromMatch;
  const targetPath = resolveScriptImportPath(specifier, sourcePath, availablePaths);
  const relations: RelationDetails[] = [];

  const namedSectionMatch = clause.match(/\{([^}]+)\}/);
  if (namedSectionMatch?.[1]) {
    for (const part of namedSectionMatch[1].split(",").map((entry) => entry.trim()).filter(Boolean)) {
      const aliasMatch = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      const importedName = aliasMatch?.[1] ?? part;
      relations.push({
        kind: "imports",
        targetPath,
        targetLabel: `${specifier}.${importedName}`
      });
    }
  }

  const namespaceMatch = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch?.[1]) {
    relations.push({
      kind: "imports",
      targetPath,
      targetLabel: specifier
    });
  }

  const defaultClause = clause.replace(/\{[^}]+\}/g, "").split(",").map((entry) => entry.trim()).find(Boolean) ?? "";
  if (defaultClause && !defaultClause.includes("* as ")) {
    relations.push({
      kind: "imports",
      targetPath,
      targetLabel: specifier
    });
  }

  if (relations.length === 0) {
    relations.push({
      kind: "imports",
      targetPath,
      targetLabel: specifier
    });
  }

  return dedupeRelations(relations);
}

function rootIdentifierName(node: SyntaxNode): string | null {
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.type === "identifier") {
      return current.text.trim() || null;
    }
    const objectNode = current.childForFieldName("object");
    if (!objectNode || objectNode === current) {
      return null;
    }
    current = objectNode;
  }
  return null;
}

function finalPropertyName(node: SyntaxNode): string | null {
  if (node.type === "identifier" || node.type === "property_identifier") {
    return node.text.trim() || null;
  }
  const propertyNode = node.childForFieldName("property");
  return propertyNode?.text.trim() || null;
}

function dedupeRelations(relations: RelationDetails[]): RelationDetails[] {
  const seen = new Set<string>();
  const deduped: RelationDetails[] = [];
  for (const relation of relations) {
    const key = `${relation.kind}\u001f${relation.targetPath ?? ""}\u001f${relation.targetLabel}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(relation);
  }
  return deduped;
}

function walkUsageNodes(node: SyntaxNode, callback: (node: SyntaxNode) => void, skipNested = false): void {
  callback(node);
  for (const child of node.namedChildren) {
    if (skipNested && ["function_declaration", "function_expression", "arrow_function", "class_declaration", "class"].includes(child.type)) {
      continue;
    }
    walkUsageNodes(child, callback, false);
  }
}

function collectUsageRelations(
  current: ScriptSymbolNode,
  topLevelByName: Map<string, SymbolRecord>,
  importAliases: Map<string, UsageTarget>
): RelationDetails[] {
  if (!["function", "class", "method"].includes(current.record.kind)) {
    return [];
  }

  const relations: RelationDetails[] = [];
  walkUsageNodes(current.node, (node) => {
    if (node.type !== "call_expression") {
      return;
    }

    const functionNode = node.childForFieldName("function");
    if (!functionNode) {
      return;
    }

    const localName = functionNode.type === "identifier" ? functionNode.text.trim() : null;
    if (localName && localName !== current.record.name) {
      const localTarget = topLevelByName.get(localName);
      if (localTarget) {
        relations.push({
          kind: "uses",
          targetPath: localTarget.path,
          targetLabel: localTarget.name
        });
        return;
      }
    }

    const rootName = rootIdentifierName(functionNode);
    if (!rootName) {
      return;
    }

    const importTarget = importAliases.get(rootName);
    if (!importTarget) {
      return;
    }

    const finalName = finalPropertyName(functionNode);
    const targetLabel = finalName && finalName !== rootName
      ? `${importTarget.labelPrefix}.${finalName}`
      : importTarget.labelPrefix;

    relations.push({
      kind: "uses",
      targetPath: importTarget.targetPath,
      targetLabel
    });
  }, true);

  return dedupeRelations(relations);
}

function extractScriptSymbols(
  path: string,
  language: "javascript" | "typescript",
  source: string,
  parser: Parser,
  availablePaths: Set<string> = new Set()
): SymbolRecord[] {
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

  const symbols: ScriptSymbolNode[] = [];

  visit(tree.rootNode, (node) => {
    if (node.type === "import_statement") {
      const statement = nodeText(source, node).trim();
      symbols.push({
        node,
        record: {
          path,
          language,
          kind: "import",
          name: statement,
          signature: statement,
          body: statement,
          doc: null,
          fallback: false,
          relations: extractImportRelations(statement, path, availablePaths),
          ...nodeSpan(node)
        }
      });
      return;
    }

    if (node.type === "class_declaration" || node.type === "class") {
      const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "identifier" || child.type === "type_identifier") ?? null;
      const heritageNode = node.childForFieldName("heritage") ?? node.namedChildren.find((child) => child.type === "class_heritage") ?? null;
      const name = identifierText(source, nameNode);
      if (!name) {
        return;
      }

      symbols.push({
        node,
        record: {
          path,
          language,
          kind: "class",
          name,
          signature: `class ${name}${nodeText(source, heritageNode).trim()}`,
          body: sliceBody(source, node.startIndex, node.endIndex),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
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
        node,
        record: {
          path,
          language,
          kind: "function",
          name,
          signature: `${name}${nodeText(source, parametersNode).trim()}${returnSuffix}`,
          body: sliceBody(source, node.startIndex, node.endIndex),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
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
        node,
        record: {
          path,
          language,
          kind: "interface",
          name,
          signature: `interface ${name}`,
          body: sliceBody(source, node.startIndex, node.endIndex),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
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
        node,
        record: {
          path,
          language,
          kind: "type",
          name,
          signature: `type ${name}`,
          body: sliceBody(source, node.startIndex, node.endIndex),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
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
        node,
        record: {
          path,
          language,
          kind: "enum",
          name,
          signature: `enum ${name}`,
          body: sliceBody(source, node.startIndex, node.endIndex),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
      });
      return;
    }

    const variableFunction = extractVariableFunctionSymbol(path, language, source, node);
    if (variableFunction) {
      symbols.push({ node, record: variableFunction });
      return;
    }

    const method = extractMethodSymbol(path, language, source, node);
    if (method) {
      symbols.push({ node, record: method });
    }
  });

  if (symbols.length > 0) {
    const topLevelByName = new Map<string, SymbolRecord>();
    for (const symbol of symbols) {
      if ((symbol.record.kind === "function" || symbol.record.kind === "class") && !topLevelByName.has(symbol.record.name)) {
        topLevelByName.set(symbol.record.name, symbol.record);
      }
    }

    const importAliases = new Map<string, UsageTarget>();
    for (const symbol of symbols) {
      if (symbol.record.kind !== "import") {
        continue;
      }
      for (const [alias, target] of parseImportAliases(symbol.record.name, path, availablePaths)) {
        importAliases.set(alias, target);
      }
    }

    return symbols.map((symbol) => {
      if (symbol.record.kind === "import") {
        return symbol.record;
      }
      const relations = [
        ...(symbol.record.relations ?? []),
        ...collectUsageRelations(symbol, topLevelByName, importAliases)
      ];
      return relations.length > 0
        ? {
            ...symbol.record,
            relations: dedupeRelations(relations)
          }
        : symbol.record;
    });
  }

  return fallbackRecord(path, language, source, `Fallback record created because no ${language} symbols were extracted.`);
}

export function extractJavaScriptSymbols(path: string, source: string, availablePaths: Set<string> = new Set()): SymbolRecord[] {
  return extractScriptSymbols(path, "javascript", source, javascriptParser, availablePaths);
}

export function extractTypeScriptSymbols(path: string, source: string, availablePaths: Set<string> = new Set()): SymbolRecord[] {
  return extractScriptSymbols(path, "typescript", source, parserForTypeScriptPath(path), availablePaths);
}
