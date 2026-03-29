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

function fallbackRecord(path: string, source: string, reason: string): SymbolRecord[] {
  return [
    {
      path,
      language: "markdown",
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

export function extractMarkdownSymbols(path: string, source: string): SymbolRecord[] {
  const lines = source.split(/\r?\n/);
  const headings: Array<{ lineIndex: number; depth: number; title: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (!match) {
      continue;
    }

    headings.push({
      lineIndex: index,
      depth: match[1].length,
      title: match[2].trim()
    });
  }

  if (headings.length === 0) {
    return fallbackRecord(path, source, "Fallback record created because no Markdown headings were extracted.");
  }

  return headings.map((heading, headingIndex) => {
    const startLine = heading.lineIndex + 1;
    const nextHeadingLine = headings[headingIndex + 1]?.lineIndex ?? lines.length;
    const sectionLines = lines.slice(heading.lineIndex, nextHeadingLine);
    const endLine = Math.max(sectionLines.length > 0 ? nextHeadingLine : startLine, startLine);

    return {
      path,
      language: "markdown" as const,
      kind: "heading",
      name: heading.title,
      signature: `${"#".repeat(heading.depth)} ${heading.title}`,
      body: sectionLines.join("\n").trim(),
      doc: null,
      fallback: false,
      startLine,
      startColumn: 1,
      endLine,
      endColumn: (lines[endLine - 1]?.length ?? 0) + 1
    };
  });
}
