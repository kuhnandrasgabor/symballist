import type { SymbolRecord } from "../types.ts";

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

function spanForLine(line: string, lineNumber: number): Pick<SymbolRecord, "startLine" | "startColumn" | "endLine" | "endColumn"> {
  return {
    startLine: lineNumber,
    startColumn: 1,
    endLine: lineNumber,
    endColumn: line.length + 1
  };
}

function fallbackRecord(path: string, language: "yaml" | "shell" | "dockerfile" | "css", source: string, reason: string): SymbolRecord[] {
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

export function extractYamlSymbols(path: string, source: string): SymbolRecord[] {
  const lines = source.split(/\r?\n/);
  const symbols: SymbolRecord[] = [];
  const stack: Array<{ indent: number; name: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const match = line.match(/^(\s*)([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!match) {
      continue;
    }

    const indent = match[1].length;
    const key = match[2];
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    const pathParts = [...stack.map((entry) => entry.name), key];
    const dottedName = pathParts.join(".");
    symbols.push({
      path,
      language: "yaml",
      kind: "key",
      name: dottedName,
      signature: line.trim(),
      body: line.trim(),
      doc: null,
      fallback: false,
      ...spanForLine(line, index + 1)
    });
    stack.push({ indent, name: key });
  }

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, "yaml", source, "Fallback record created because no YAML keys were extracted.");
}

export function extractShellSymbols(path: string, source: string): SymbolRecord[] {
  const lines = source.split(/\r?\n/);
  const symbols: SymbolRecord[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\))?\s*\{/);
    if (!match) {
      continue;
    }

    const name = match[1];
    let endLine = index + 1;
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextTrimmed = (lines[next] ?? "").trim();
      if (nextTrimmed === "}") {
        endLine = next + 1;
        break;
      }
      if (/^(?:function\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?:\(\))?\s*\{/.test(nextTrimmed)) {
        break;
      }
      endLine = next + 1;
    }

    symbols.push({
      path,
      language: "shell",
      kind: "function",
      name,
      signature: trimmed,
      body: lines.slice(index, endLine).join("\n").trim(),
      doc: null,
      fallback: false,
      startLine: index + 1,
      startColumn: 1,
      endLine,
      endColumn: (lines[endLine - 1]?.length ?? 0) + 1
    });
  }

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, "shell", source, "Fallback record created because no shell functions were extracted.");
}

export function extractDockerfileSymbols(path: string, source: string): SymbolRecord[] {
  const lines = source.split(/\r?\n/);
  const symbols: SymbolRecord[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const stageMatch = trimmed.match(/^FROM\s+.+?\s+AS\s+([A-Za-z0-9_.-]+)$/i);
    if (stageMatch) {
      symbols.push({
        path,
        language: "dockerfile",
        kind: "stage",
        name: stageMatch[1],
        signature: trimmed,
        body: trimmed,
        doc: null,
        fallback: false,
        ...spanForLine(line, index + 1)
      });
      continue;
    }

    const argEnvMatch = trimmed.match(/^(ARG|ENV)\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (argEnvMatch) {
      symbols.push({
        path,
        language: "dockerfile",
        kind: argEnvMatch[1].toLowerCase(),
        name: argEnvMatch[2],
        signature: trimmed,
        body: trimmed,
        doc: null,
        fallback: false,
        ...spanForLine(line, index + 1)
      });
    }
  }

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, "dockerfile", source, "Fallback record created because no Dockerfile stages or variables were extracted.");
}

export function extractCssSymbols(path: string, source: string): SymbolRecord[] {
  const lines = source.split(/\r?\n/);
  const symbols: SymbolRecord[] = [];
  const regex = /([^{}]+)\{/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const selectorBlock = match[1]?.trim() ?? "";
    if (!selectorBlock) {
      continue;
    }

    const before = source.slice(0, match.index);
    const lineNumber = before.split(/\r?\n/).length;
    const selectors = selectorBlock.split(",").map((part) => part.trim()).filter(Boolean);
    for (const selector of selectors) {
      symbols.push({
        path,
        language: "css",
        kind: selector.startsWith("@") ? "at_rule" : "selector",
        name: selector,
        signature: selector,
        body: selector,
        doc: null,
        fallback: false,
        ...spanForLine(lines[lineNumber - 1] ?? selector, lineNumber)
      });
    }
  }

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, "css", source, "Fallback record created because no CSS selectors were extracted.");
}
