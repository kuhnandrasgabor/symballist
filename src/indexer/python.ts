import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import type { SymbolRecord } from "../types.ts";

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

export function extractPythonSymbols(path: string, source: string): SymbolRecord[] {
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
