import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import { dirname, join, normalize } from "node:path";
import type { RelationDetails, SymbolRecord } from "../types.ts";

const parser = new Parser();
parser.setLanguage(Python);
const MAX_TREE_SITTER_SOURCE_CHARS = 32000;
const PYTHON_IDENTIFIER = "[A-Za-z_][A-Za-z0-9_]*";

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

type PythonTopLevelSymbol = {
  node: SyntaxNode;
  record: SymbolRecord;
};

type UsageTarget = {
  targetPath: string;
  labelPrefix: string;
};

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

type LineIndex = {
  lines: string[];
  starts: number[];
};

function buildLineIndex(source: string): LineIndex {
  const lines = source.split(/\r?\n/);
  const starts: number[] = [];
  let cursor = 0;

  for (const line of lines) {
    starts.push(cursor);
    cursor += line.length;
    if (source[cursor] === "\r" && source[cursor + 1] === "\n") {
      cursor += 2;
    } else if (source[cursor] === "\n") {
      cursor += 1;
    }
  }

  return { lines, starts };
}

function lineIndent(line: string): number {
  const match = line.match(/^[ \t]*/);
  return match?.[0]?.length ?? 0;
}

function lineStartOffset(index: LineIndex, lineNumber: number): number {
  return index.starts[lineNumber - 1] ?? 0;
}

function lineEndOffset(source: string, index: LineIndex, lineNumber: number): number {
  if (lineNumber >= index.starts.length) {
    return source.length;
  }
  return index.starts[lineNumber] - (source[index.starts[lineNumber] - 2] === "\r" ? 2 : 1);
}

function sliceLines(source: string, index: LineIndex, startLine: number, endLine: number): string {
  const start = lineStartOffset(index, startLine);
  const end = lineEndOffset(source, index, endLine);
  return source.slice(start, Math.max(start, end)).trim();
}

function statementBalance(line: string): number {
  let balance = 0;
  for (const char of line) {
    if (char === "(" || char === "[" || char === "{") {
      balance += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      balance -= 1;
    }
  }
  return balance;
}

function nextTopLevelBoundary(index: LineIndex, startLine: number): number {
  for (let lineNumber = startLine + 1; lineNumber <= index.lines.length; lineNumber += 1) {
    const line = index.lines[lineNumber - 1] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (lineIndent(line) === 0) {
      return lineNumber - 1;
    }
  }
  return index.lines.length;
}

function recoverOversizedPythonSymbols(path: string, source: string): SymbolRecord[] {
  const index = buildLineIndex(source);
  const symbols: SymbolRecord[] = [];
  let lineNumber = 1;

  while (lineNumber <= index.lines.length) {
    const line = index.lines[lineNumber - 1] ?? "";
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || lineIndent(line) !== 0) {
      lineNumber += 1;
      continue;
    }

    let startLine = lineNumber;
    while (startLine > 1) {
      const previous = index.lines[startLine - 2] ?? "";
      const previousTrimmed = previous.trim();
      if (lineIndent(previous) === 0 && previousTrimmed.startsWith("@")) {
        startLine -= 1;
        continue;
      }
      break;
    }

    if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
      let endLine = lineNumber;
      let balance = statementBalance(line);
      while (endLine < index.lines.length) {
        const current = index.lines[endLine - 1] ?? "";
        const currentTrimmed = current.trimEnd();
        const shouldContinue = balance > 0 || currentTrimmed.endsWith("\\");
        if (!shouldContinue) {
          break;
        }
        endLine += 1;
        balance += statementBalance(index.lines[endLine - 1] ?? "");
      }

      const statement = sliceLines(source, index, lineNumber, endLine);
      if (statement) {
        symbols.push({
          path,
          language: "python",
          kind: "import",
          name: statement,
          signature: statement,
          body: statement,
          doc: "Recovered from oversized Python file via lightweight top-level scan.",
          fallback: false,
          startLine: lineNumber,
          startColumn: 1,
          endLine,
          endColumn: (index.lines[endLine - 1]?.length ?? 0) + 1
        });
      }

      lineNumber = endLine + 1;
      continue;
    }

    let headerEndLine = lineNumber;
    let balance = statementBalance(line);
    const isClassHeader = trimmed.startsWith("class ");
    const isFunctionHeader = trimmed.startsWith("def ") || trimmed.startsWith("async def ");

    if (!isClassHeader && !isFunctionHeader) {
      lineNumber += 1;
      continue;
    }

    while (headerEndLine < index.lines.length) {
      const current = index.lines[headerEndLine - 1] ?? "";
      const currentTrimmed = current.trimEnd();
      const hasColon = currentTrimmed.endsWith(":");
      if (balance <= 0 && hasColon) {
        break;
      }
      headerEndLine += 1;
      balance += statementBalance(index.lines[headerEndLine - 1] ?? "");
    }

    const bodyEndLine = nextTopLevelBoundary(index, headerEndLine);
    const headerText = sliceLines(source, index, lineNumber, headerEndLine).replace(/\s+/g, " ").trim();
    const bodyText = sliceLines(source, index, startLine, bodyEndLine);

    if (isClassHeader) {
      const match = headerText.match(new RegExp(`^class\\s+(${PYTHON_IDENTIFIER})(.*):$`));
      const name = match?.[1] ?? "";
      const signatureSuffix = match?.[2]?.trim() ?? "";
      if (name) {
        symbols.push({
          path,
          language: "python",
          kind: "class",
          name,
          signature: `class ${name}${signatureSuffix}`,
          body: bodyText || headerText,
          doc: "Recovered from oversized Python file via lightweight top-level scan.",
          fallback: false,
          startLine: lineNumber,
          startColumn: 1,
          endLine: bodyEndLine,
          endColumn: (index.lines[bodyEndLine - 1]?.length ?? 0) + 1
        });
      }
    } else {
      const match = headerText.match(new RegExp(`^(?:async\\s+def|def)\\s+(${PYTHON_IDENTIFIER})(\\s*\\(.*\\))(?:\\s*->\\s*.+)?\\s*:$`));
      const name = match?.[1] ?? "";
      const parameters = match?.[2]?.trim() ?? "";
      if (name) {
        symbols.push({
          path,
          language: "python",
          kind: "function",
          name,
          signature: `${name}${parameters}`,
          body: bodyText || headerText,
          doc: "Recovered from oversized Python file via lightweight top-level scan.",
          fallback: false,
          startLine: lineNumber,
          startColumn: 1,
          endLine: bodyEndLine,
          endColumn: (index.lines[bodyEndLine - 1]?.length ?? 0) + 1
        });
      }
    }

    lineNumber = Math.max(headerEndLine + 1, bodyEndLine + 1);
  }

  return symbols;
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

function resolvePythonModulePath(moduleName: string, sourcePath: string, availablePaths: Set<string>): string | null {
  const trimmed = moduleName.trim();
  if (!trimmed) {
    return null;
  }

  const relativeDots = trimmed.match(/^\.+/)?.[0].length ?? 0;
  const bareModule = trimmed.slice(relativeDots);
  const sourceDir = dirname(sourcePath);
  let baseDir = relativeDots > 0 ? sourceDir : "";

  for (let index = 1; index < relativeDots; index += 1) {
    baseDir = dirname(baseDir);
  }

  const moduleSegments = bareModule ? bareModule.split(".").filter(Boolean) : [];
  const baseCandidate = normalize(join(baseDir, ...moduleSegments));
  const candidates = [
    `${baseCandidate}.py`,
    join(baseCandidate, "__init__.py")
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

  if (normalized.startsWith("import ")) {
    const parts = normalized.slice("import ".length).split(",").map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const aliasMatch = part.match(/^([.\w]+)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/i);
      if (!aliasMatch) {
        continue;
      }
      const [, moduleName, explicitAlias] = aliasMatch;
      const alias = explicitAlias?.trim() || moduleName.split(".").pop() || "";
      const targetPath = resolvePythonModulePath(moduleName, sourcePath, availablePaths);
      if (!alias || !targetPath) {
        continue;
      }
      aliases.set(alias, { targetPath, labelPrefix: moduleName });
    }
    return aliases;
  }

  const fromMatch = normalized.match(/^from\s+([.\w]+)\s+import\s+(.+)$/i);
  if (!fromMatch) {
    return aliases;
  }

  const [, moduleName, importedSection] = fromMatch;
  const importedNames = importedSection
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of importedNames) {
    const aliasMatch = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/i);
    if (!aliasMatch) {
      continue;
    }
    const [, importedName, explicitAlias] = aliasMatch;
    if (importedName === "*") {
      continue;
    }
    const alias = explicitAlias?.trim() || importedName;
    const targetPath = resolvePythonModulePath(`${moduleName}.${importedName}`, sourcePath, availablePaths)
      ?? resolvePythonModulePath(moduleName, sourcePath, availablePaths);
    if (!alias || !targetPath) {
      continue;
    }
    aliases.set(alias, { targetPath, labelPrefix: `${moduleName}.${importedName}` });
  }

  return aliases;
}

function rootIdentifierName(node: SyntaxNode): string | null {
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.type === "identifier") {
      return current.text.trim() || null;
    }
    const valueNode = current.childForFieldName("object") ?? current.childForFieldName("value");
    if (!valueNode || valueNode === current) {
      return null;
    }
    current = valueNode;
  }
  return null;
}

function finalAttributeName(node: SyntaxNode): string | null {
  if (node.type === "identifier") {
    return node.text.trim() || null;
  }
  if (node.type !== "attribute") {
    return null;
  }
  const attributeNode = node.childForFieldName("attribute");
  return attributeNode?.text.trim() || null;
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
    if (skipNested && (child.type === "function_definition" || child.type === "class_definition")) {
      continue;
    }
    walkUsageNodes(child, callback, false);
  }
}

function collectPythonUsageRelations(
  current: PythonTopLevelSymbol,
  topLevelByName: Map<string, SymbolRecord>,
  importAliases: Map<string, UsageTarget>
): RelationDetails[] {
  if (current.record.kind !== "function" && current.record.kind !== "class") {
    return [];
  }

  const relations: RelationDetails[] = [];
  walkUsageNodes(current.node, (node) => {
    if (node.type !== "call") {
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

    const finalName = finalAttributeName(functionNode);
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

export function extractPythonSymbols(path: string, source: string, availablePaths: Set<string> = new Set()): SymbolRecord[] {
  if (source.length > MAX_TREE_SITTER_SOURCE_CHARS) {
    const recovered = recoverOversizedPythonSymbols(path, source);
    if (recovered.length > 0) {
      return recovered;
    }
    return fallbackRecord(
      path,
      source,
      `Fallback record created because Python source exceeded the safe tree-sitter size limit (${MAX_TREE_SITTER_SOURCE_CHARS} chars) on this runtime.`
    );
  }

  const symbols: PythonTopLevelSymbol[] = [];
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
        node,
        record: {
          path,
          language: "python",
          kind: "import",
          name: statement,
          signature: statement,
          body: statement,
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
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
        node,
        record: {
          path,
          language: "python",
          kind: "class",
          name,
          signature,
          body: sliceBody(source, node.startIndex, node.endIndex),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
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
        node,
        record: {
          path,
          language: "python",
          kind: "function",
          name,
          signature,
          body: sliceBody(source, node.startIndex, node.endIndex),
          doc: null,
          fallback: false,
          ...nodeSpan(node)
        }
      });
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

      const relations = collectPythonUsageRelations(symbol, topLevelByName, importAliases);
      return relations.length > 0
        ? {
            ...symbol.record,
            relations
          }
        : symbol.record;
    });
  }

  return fallbackRecord(path, source, "Fallback record created because no Python symbols were extracted.");
}
