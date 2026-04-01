import { dirname, join, normalize } from "node:path";
import Parser from "tree-sitter";
import Ruby from "tree-sitter-ruby";
import type { SyntaxNode } from "tree-sitter";
import type { RelationDetails, SymbolRecord } from "../types.ts";
import { MAX_TREE_SITTER_SOURCE_CHARS, oversizedFallbackReason, oversizedRecoveryDoc } from "./oversized.ts";

const parser = new Parser();
parser.setLanguage(Ruby);

type UsageTarget = {
  targetPath: string;
  labelPrefix: string;
};

type RubyAutoloadRoot = {
  rootPath: string;
  category:
    | "models"
    | "services"
    | "controllers"
    | "helpers"
    | "jobs"
    | "workers"
    | "mailers"
    | "serializers"
    | "policies"
    | "queries"
    | "forms"
    | "presenters"
    | "validators"
    | "lib"
    | "concerns"
    | "root";
  priority: number;
};

type RubyAutoloadCandidate = {
  path: string;
  category: RubyAutoloadRoot["category"];
  priority: number;
};

type RubySymbolNode = {
  node: SyntaxNode;
  record: SymbolRecord;
};

type LineIndex = {
  lines: string[];
  starts: number[];
};

function nodeText(source: string, node: SyntaxNode | null): string {
  if (!node) {
    return "";
  }
  return source.slice(node.startIndex, node.endIndex);
}

function sliceBody(source: string, start: number, end: number): string {
  const body = source.slice(start, end).trim();
  return body.length > 0 ? body : source.trim();
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

function rubyBlockDelta(line: string): number {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return 0;
  }

  let delta = 0;
  if (/^(class|module|def|if|unless|case|begin|while|until|for)\b/.test(trimmed)) {
    delta += 1;
  }
  if (/\bdo\b(?:\s*\|[^|]*\|)?\s*$/.test(trimmed)) {
    delta += 1;
  }
  if (/^end\b/.test(trimmed)) {
    delta -= 1;
  }
  return delta;
}

function nextRubyBlockBoundary(index: LineIndex, startLine: number): number {
  let depth = 0;
  for (let lineNumber = startLine; lineNumber <= index.lines.length; lineNumber += 1) {
    depth += rubyBlockDelta(index.lines[lineNumber - 1] ?? "");
    if (depth <= 0) {
      return lineNumber;
    }
  }
  return index.lines.length;
}

function recoverOversizedRubySymbols(path: string, source: string, availablePaths: Set<string>): SymbolRecord[] {
  const index = buildLineIndex(source);
  const symbols: SymbolRecord[] = [];
  const namespaceStack: Array<{ type: "class" | "module"; name: string; endLine: number }> = [];

  for (let lineNumber = 1; lineNumber <= index.lines.length; lineNumber += 1) {
    while (namespaceStack.length > 0 && lineNumber > namespaceStack[namespaceStack.length - 1]!.endLine) {
      namespaceStack.pop();
    }

    const line = index.lines[lineNumber - 1] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const requireRelations = extractRequireRelations(trimmed, path, availablePaths);
    if (requireRelations.length > 0) {
      symbols.push({
        path,
        language: "ruby",
        kind: "import",
        name: trimmed,
        signature: trimmed,
        body: trimmed,
        doc: oversizedRecoveryDoc("ruby"),
        fallback: false,
        relations: requireRelations,
        startLine: lineNumber,
        startColumn: 1,
        endLine: lineNumber,
        endColumn: (index.lines[lineNumber - 1]?.length ?? 0) + 1
      });
      continue;
    }

    const classOrModuleMatch = trimmed.match(/^(class|module)\s+([A-Z][A-Za-z0-9_:]*)\b/);
    if (classOrModuleMatch) {
      const kind = classOrModuleMatch[1] as "class" | "module";
      const rawName = classOrModuleMatch[2];
      const shortName = rawName.split("::").at(-1) ?? rawName;
      const currentNamespace = namespaceStack.map((entry) => entry.name);
      const qualifiedName = rawName.includes("::")
        ? rawName
        : currentNamespace.length > 0
          ? `${currentNamespace.join("::")}::${rawName}`
          : rawName;
      const endLine = nextRubyBlockBoundary(index, lineNumber);
      symbols.push({
        path,
        language: "ruby",
        kind,
        name: shortName,
        signature: `${kind} ${qualifiedName}`,
        body: sliceLines(source, index, lineNumber, endLine),
        doc: oversizedRecoveryDoc("ruby"),
        fallback: false,
        startLine: lineNumber,
        startColumn: 1,
        endLine,
        endColumn: (index.lines[endLine - 1]?.length ?? 0) + 1
      });
      namespaceStack.push({ type: kind, name: shortName, endLine });
      continue;
    }

    const singletonMethodMatch = trimmed.match(/^def\s+self\.([A-Za-z_][A-Za-z0-9_!?=]*)\b(.*)$/);
    if (singletonMethodMatch) {
      const currentNamespace = namespaceStack.map((entry) => entry.name);
      const prefix = currentNamespace.length > 0 ? `${currentNamespace.join("::")}.` : "self.";
      const endLine = nextRubyBlockBoundary(index, lineNumber);
      symbols.push({
        path,
        language: "ruby",
        kind: "method",
        name: singletonMethodMatch[1],
        signature: `${prefix}${singletonMethodMatch[1]}${singletonMethodMatch[2].trim()}`,
        body: sliceLines(source, index, lineNumber, endLine),
        doc: oversizedRecoveryDoc("ruby"),
        fallback: false,
        startLine: lineNumber,
        startColumn: 1,
        endLine,
        endColumn: (index.lines[endLine - 1]?.length ?? 0) + 1
      });
      continue;
    }

    const methodMatch = trimmed.match(/^def\s+([A-Za-z_][A-Za-z0-9_!?=]*)\b(.*)$/);
    if (methodMatch) {
      const currentNamespace = namespaceStack.map((entry) => entry.name);
      const prefix = currentNamespace.length > 0 ? `${currentNamespace.join("::")}#` : "";
      const endLine = nextRubyBlockBoundary(index, lineNumber);
      symbols.push({
        path,
        language: "ruby",
        kind: "method",
        name: methodMatch[1],
        signature: `${prefix}${methodMatch[1]}${methodMatch[2].trim()}`,
        body: sliceLines(source, index, lineNumber, endLine),
        doc: oversizedRecoveryDoc("ruby"),
        fallback: false,
        startLine: lineNumber,
        startColumn: 1,
        endLine,
        endColumn: (index.lines[endLine - 1]?.length ?? 0) + 1
      });
      continue;
    }

    const constantMatch = trimmed.match(/^([A-Z][A-Za-z0-9_]*)\s*=/);
    if (constantMatch) {
      const currentNamespace = namespaceStack.map((entry) => entry.name);
      symbols.push({
        path,
        language: "ruby",
        kind: "constant",
        name: constantMatch[1],
        signature: currentNamespace.length > 0 ? `${currentNamespace.join("::")}::${constantMatch[1]}` : constantMatch[1],
        body: trimmed,
        doc: oversizedRecoveryDoc("ruby"),
        fallback: false,
        startLine: lineNumber,
        startColumn: 1,
        endLine: lineNumber,
        endColumn: (index.lines[lineNumber - 1]?.length ?? 0) + 1
      });
    }
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
      language: "ruby",
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

function identifierText(source: string, node: SyntaxNode | null): string {
  return nodeText(source, node).trim();
}

function enclosingNamespace(source: string, node: SyntaxNode): string[] {
  const names: string[] = [];
  let current: SyntaxNode | null = node.parent;
  while (current) {
    if (current.type === "class" || current.type === "module") {
      const nameNode = current.childForFieldName("name") ?? current.namedChildren.find((child) => child.type === "constant") ?? null;
      const name = identifierText(source, nameNode);
      if (name) {
        names.unshift(name);
      }
    }
    current = current.parent;
  }
  return names;
}

function findSymbolContainerName(source: string, node: SyntaxNode): string | null {
  const namespace = enclosingNamespace(source, node);
  return namespace.length > 0 ? namespace.join("::") : null;
}

function resolveRubyRequirePath(specifier: string, sourcePath: string, availablePaths: Set<string>, relativeOnly: boolean): string | null {
  const trimmed = specifier.trim();
  if (!trimmed) {
    return null;
  }

  const base = relativeOnly
    ? normalize(join(dirname(sourcePath), trimmed))
    : normalize(trimmed);
  const candidates = base.endsWith(".rb")
    ? [base]
    : [`${base}.rb`, join(base, "init.rb")];

  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    if (availablePaths.has(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  return null;
}

function extractRequireRelations(statement: string, sourcePath: string, availablePaths: Set<string>): RelationDetails[] {
  const normalized = statement.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const requireMatch = normalized.match(/^require\s+["']([^"']+)["']$/);
  if (requireMatch?.[1]) {
    const targetPath = resolveRubyRequirePath(requireMatch[1], sourcePath, availablePaths, false);
    return [{
      kind: "imports",
      targetPath,
      targetLabel: requireMatch[1]
    }];
  }

  const requireRelativeMatch = normalized.match(/^require_relative\s+["']([^"']+)["']$/);
  if (requireRelativeMatch?.[1]) {
    const targetPath = resolveRubyRequirePath(requireRelativeMatch[1], sourcePath, availablePaths, true);
    return [{
      kind: "imports",
      targetPath,
      targetLabel: requireRelativeMatch[1]
    }];
  }

  return [];
}

function snakeCaseRubySegment(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

function splitRubyConstantReference(value: string): string[] {
  return value
    .trim()
    .replace(/^::/, "")
    .split("::")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isRubyConstantReference(value: string): boolean {
  return /^[A-Z][A-Za-z0-9_]*(::[A-Z][A-Za-z0-9_]*)*$/.test(value.trim());
}

const RUBY_AUTOLOAD_ROOTS: RubyAutoloadRoot[] = [
  { rootPath: join("app", "models"), category: "models", priority: 0 },
  { rootPath: join("app", "models", "concerns"), category: "concerns", priority: 1 },
  { rootPath: join("app", "services"), category: "services", priority: 2 },
  { rootPath: join("app", "controllers"), category: "controllers", priority: 3 },
  { rootPath: join("app", "controllers", "concerns"), category: "concerns", priority: 4 },
  { rootPath: join("app", "helpers"), category: "helpers", priority: 5 },
  { rootPath: join("app", "jobs"), category: "jobs", priority: 6 },
  { rootPath: join("app", "workers"), category: "workers", priority: 7 },
  { rootPath: join("app", "mailers"), category: "mailers", priority: 8 },
  { rootPath: join("app", "serializers"), category: "serializers", priority: 9 },
  { rootPath: join("app", "policies"), category: "policies", priority: 10 },
  { rootPath: join("app", "queries"), category: "queries", priority: 11 },
  { rootPath: join("app", "forms"), category: "forms", priority: 12 },
  { rootPath: join("app", "presenters"), category: "presenters", priority: 13 },
  { rootPath: join("app", "validators"), category: "validators", priority: 14 },
  { rootPath: join("app", "concerns"), category: "concerns", priority: 15 },
  { rootPath: join("app", "lib"), category: "lib", priority: 16 },
  { rootPath: join("lib"), category: "lib", priority: 17 },
  { rootPath: join("lib", "concerns"), category: "concerns", priority: 18 },
  { rootPath: "", category: "root", priority: 19 }
];

function sourceRubyAutoloadCategory(sourcePath: string): RubyAutoloadRoot["category"] | null {
  const normalizedPath = normalize(sourcePath);
  const matched = RUBY_AUTOLOAD_ROOTS.find((root) =>
    root.rootPath.length > 0
    && (normalizedPath === root.rootPath || normalizedPath.startsWith(`${root.rootPath}/`))
  );
  return matched?.category ?? null;
}

function rubyAutoloadCandidatePaths(relativeSegments: string[]): RubyAutoloadCandidate[] {
  const relativePath = join(...relativeSegments.map((segment) => snakeCaseRubySegment(segment)));

  return RUBY_AUTOLOAD_ROOTS.map((root) => ({
    path: normalize(root.rootPath.length > 0 ? join(root.rootPath, `${relativePath}.rb`) : `${relativePath}.rb`),
    category: root.category,
    priority: root.priority
  }));
}

function scoreRubyAutoloadCandidate(
  candidate: RubyAutoloadCandidate,
  sourcePath: string,
  lexicalNamespaceDepth: number
): number {
  const sourceCategory = sourceRubyAutoloadCategory(sourcePath);
  let score = 100 - candidate.priority;

  if (sourceCategory && candidate.category === sourceCategory) {
    score += 25;
  }
  if (candidate.category === "concerns") {
    score += 8;
  }
  if (candidate.category === "lib" && sourceCategory === "lib") {
    score += 6;
  }
  score += lexicalNamespaceDepth * 3;
  return score;
}

function resolveRubyConstantPath(
  reference: string,
  sourcePath: string,
  availablePaths: Set<string>,
  lexicalNamespace: string[]
): UsageTarget | null {
  if (!isRubyConstantReference(reference)) {
    return null;
  }

  const segments = splitRubyConstantReference(reference);
  if (segments.length === 0) {
    return null;
  }

  const candidateSegmentSets: string[][] = [];
  if (reference.includes("::")) {
    candidateSegmentSets.push(segments);
  } else {
    for (let index = lexicalNamespace.length; index >= 0; index -= 1) {
      candidateSegmentSets.push([...lexicalNamespace.slice(0, index), ...segments]);
    }
  }

  const resolvedCandidates = new Map<string, { labelPrefix: string; score: number }>();
  for (const candidateSegments of candidateSegmentSets) {
    for (const candidate of rubyAutoloadCandidatePaths(candidateSegments)) {
      if (availablePaths.has(candidate.path)) {
        const score = scoreRubyAutoloadCandidate(candidate, sourcePath, candidateSegments.length - segments.length);
        const existing = resolvedCandidates.get(candidate.path);
        if (!existing || existing.score < score) {
          resolvedCandidates.set(candidate.path, {
            labelPrefix: candidateSegments.join("::"),
            score
          });
        }
      }
    }
  }

  if (resolvedCandidates.size === 0) {
    return null;
  }

  const rankedCandidates = [...resolvedCandidates.entries()]
    .map(([targetPath, details]) => ({
      targetPath,
      labelPrefix: details.labelPrefix,
      score: details.score
    }))
    .sort((left, right) => right.score - left.score || left.targetPath.localeCompare(right.targetPath));

  if (rankedCandidates.length > 1 && rankedCandidates[0]!.score === rankedCandidates[1]!.score) {
    return null;
  }

  const [best] = rankedCandidates;
  if (!best) {
    return null;
  }

  return {
    targetPath: best.targetPath,
    labelPrefix: best.labelPrefix
  };
}

function parseRequireAliases(statement: string, sourcePath: string, availablePaths: Set<string>): Map<string, UsageTarget> {
  const aliases = new Map<string, UsageTarget>();
  const normalized = statement.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  const requireMatch = normalized.match(/^require\s+["']([^"']+)["']$/);
  if (requireMatch?.[1]) {
    const targetPath = resolveRubyRequirePath(requireMatch[1], sourcePath, availablePaths, false);
    if (targetPath) {
      const lastSegment = requireMatch[1].split("/").at(-1) ?? requireMatch[1];
      const constantAlias = lastSegment
        .split("_")
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join("");
      if (constantAlias) {
        aliases.set(constantAlias, {
          targetPath,
          labelPrefix: requireMatch[1]
        });
      }
    }
  }

  const requireRelativeMatch = normalized.match(/^require_relative\s+["']([^"']+)["']$/);
  if (requireRelativeMatch?.[1]) {
    const targetPath = resolveRubyRequirePath(requireRelativeMatch[1], sourcePath, availablePaths, true);
    if (targetPath) {
      const lastSegment = requireRelativeMatch[1].split("/").at(-1) ?? requireRelativeMatch[1];
      const constantAlias = lastSegment
        .replace(/^\.\//, "")
        .split("_")
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join("");
      if (constantAlias) {
        aliases.set(constantAlias, {
          targetPath,
          labelPrefix: requireRelativeMatch[1]
        });
      }
    }
  }

  return aliases;
}

function topLevelRequireStatements(source: string, root: SyntaxNode): SyntaxNode[] {
  return root.namedChildren.filter((child) => child.type === "call");
}

function extractMethodSymbol(path: string, source: string, node: SyntaxNode, singleton: boolean): SymbolRecord | null {
  const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "identifier") ?? null;
  const name = identifierText(source, nameNode);
  if (!name) {
    return null;
  }

  const parametersNode = node.namedChildren.find((child) => child.type === "method_parameters") ?? null;
  const container = findSymbolContainerName(source, node);
  const prefix = singleton
    ? container
      ? `${container}.`
      : "self."
    : container
      ? `${container}#`
      : "";

  return {
    path,
    language: "ruby",
    kind: "method",
    name,
    signature: `${prefix}${name}${nodeText(source, parametersNode).trim()}`,
    body: sliceBody(source, node.startIndex, node.endIndex),
    doc: null,
    fallback: false,
    ...nodeSpan(node)
  };
}

function extractClassOrModuleSymbol(path: string, source: string, node: SyntaxNode, kind: "class" | "module"): SymbolRecord | null {
  const nameNode = node.childForFieldName("name") ?? node.namedChildren.find((child) => child.type === "constant") ?? null;
  const name = identifierText(source, nameNode);
  if (!name) {
    return null;
  }

  const namespace = enclosingNamespace(source, node.parent ?? node);
  const qualifiedName = namespace.length > 0 ? `${namespace.join("::")}::${name}` : name;

  return {
    path,
    language: "ruby",
    kind,
    name,
    signature: `${kind} ${qualifiedName}`,
    body: sliceBody(source, node.startIndex, node.endIndex),
    doc: null,
    fallback: false,
    ...nodeSpan(node)
  };
}

function extractConstantSymbol(path: string, source: string, node: SyntaxNode): SymbolRecord | null {
  if (node.type !== "assignment") {
    return null;
  }

  const constantNode = node.namedChildren.find((child) => child.type === "constant") ?? null;
  const name = identifierText(source, constantNode);
  if (!name) {
    return null;
  }

  const container = findSymbolContainerName(source, node);
  return {
    path,
    language: "ruby",
    kind: "constant",
    name,
    signature: container ? `${container}::${name}` : name,
    body: sliceBody(source, node.startIndex, node.endIndex),
    doc: null,
    fallback: false,
    ...nodeSpan(node)
  };
}

function extractUsesForSymbol(
  source: string,
  owner: RubySymbolNode,
  sourcePath: string,
  availablePaths: Set<string>,
  aliases: Map<string, UsageTarget>,
  localSymbols: Map<string, SymbolRecord>
): RelationDetails[] {
  const relations: RelationDetails[] = [];
  const seen = new Set<string>();
  const lexicalNamespace = enclosingNamespace(source, owner.node);

  const pushRelation = (relation: RelationDetails): void => {
    const key = `${relation.kind}::${relation.targetPath ?? ""}::${relation.targetLabel}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    relations.push(relation);
  };

  const pushResolvedReference = (reference: string): void => {
    const resolvedTarget = resolveRubyConstantPath(reference, sourcePath, availablePaths, lexicalNamespace);
    if (resolvedTarget && resolvedTarget.targetPath !== owner.record.path) {
      pushRelation({
        kind: "uses",
        targetPath: resolvedTarget.targetPath,
        targetLabel: resolvedTarget.labelPrefix
      });
      return;
    }

    if (aliases.has(reference)) {
      const target = aliases.get(reference)!;
      pushRelation({
        kind: "uses",
        targetPath: target.targetPath,
        targetLabel: target.labelPrefix
      });
      return;
    }

    if (localSymbols.has(reference)) {
      const target = localSymbols.get(reference)!;
      pushRelation({
        kind: "uses",
        targetPath: target.path,
        targetLabel: target.signature ?? target.name
      });
    }
  };

  const pushStructuralReferences = (node: SyntaxNode): void => {
    const superclassNode = node.childForFieldName("superclass");
    const superclassReference = identifierText(source, superclassNode);
    if (superclassReference) {
      pushResolvedReference(superclassReference);
    }

    for (const child of node.namedChildren) {
      if (child.type !== "call") {
        continue;
      }
      const receiver = identifierText(source, child.childForFieldName("receiver"));
      const method = identifierText(source, child.childForFieldName("method"));
      if (receiver || !["include", "extend", "prepend"].includes(method)) {
        continue;
      }

      visit(child, (descendant) => {
        if (descendant.type === "constant" || descendant.type === "scope_resolution") {
          const reference = identifierText(source, descendant);
          if (reference) {
            pushResolvedReference(reference);
          }
        }
      });
    }
  };

  if (owner.record.kind === "class" || owner.record.kind === "module") {
    pushStructuralReferences(owner.node);
  }

  visit(owner.node, (node) => {
    if (node.type !== "call") {
      if (node.type === "constant" || node.type === "scope_resolution") {
        const reference = identifierText(source, node);
        if (reference) {
          pushResolvedReference(reference);
        }
      }
      return;
    }

    const receiverNode = node.childForFieldName("receiver");
    const methodNode = node.childForFieldName("method");
    const receiver = identifierText(source, receiverNode);
    const method = identifierText(source, methodNode);

    if (receiver && aliases.has(receiver) && method) {
      const target = aliases.get(receiver)!;
      pushRelation({
        kind: "uses",
        targetPath: target.targetPath,
        targetLabel: `${target.labelPrefix}.${method}`
      });
      return;
    }

    const resolvedConstantTarget = receiver
      ? resolveRubyConstantPath(receiver, sourcePath, availablePaths, lexicalNamespace)
      : null;
    if (resolvedConstantTarget && resolvedConstantTarget.targetPath !== owner.record.path) {
      pushRelation({
        kind: "uses",
        targetPath: resolvedConstantTarget.targetPath,
        targetLabel: method ? `${resolvedConstantTarget.labelPrefix}.${method}` : resolvedConstantTarget.labelPrefix
      });
      return;
    }

    if (receiver && localSymbols.has(receiver)) {
      const target = localSymbols.get(receiver)!;
      pushRelation({
        kind: "uses",
        targetPath: target.path,
        targetLabel: target.signature ?? target.name
      });
      return;
    }

    if (!receiver && method && localSymbols.has(method)) {
      const target = localSymbols.get(method)!;
      pushRelation({
        kind: "uses",
        targetPath: target.path,
        targetLabel: target.signature ?? target.name
      });
    }
  });

  return relations;
}

export function extractRubySymbols(path: string, source: string, availablePaths: Set<string> = new Set()): SymbolRecord[] {
  if (source.length > MAX_TREE_SITTER_SOURCE_CHARS) {
    const recovered = recoverOversizedRubySymbols(path, source, availablePaths);
    if (recovered.length > 0) {
      return recovered;
    }
    return fallbackRecord(path, source, oversizedFallbackReason("Ruby"));
  }

  const tree = parser.parse(source);
  const root = tree.rootNode;
  const symbols: SymbolRecord[] = [];
  const symbolNodes: RubySymbolNode[] = [];

  const requireStatements = topLevelRequireStatements(source, root);
  const aliases = new Map<string, UsageTarget>();
  for (const statementNode of requireStatements) {
    const statement = nodeText(source, statementNode).trim();
    const importRecord: SymbolRecord = {
      path,
      language: "ruby",
      kind: "import",
      name: statement,
      signature: statement,
      body: statement,
      doc: null,
      fallback: false,
      relations: extractRequireRelations(statement, path, availablePaths),
      ...nodeSpan(statementNode)
    };
    symbols.push(importRecord);
    for (const [alias, target] of parseRequireAliases(statement, path, availablePaths)) {
      aliases.set(alias, target);
    }
  }

  visit(root, (node) => {
    if (node.parent !== root && node.parent?.type !== "body_statement" && node.parent?.parent !== root) {
      return;
    }

    if (node.type === "class") {
      const record = extractClassOrModuleSymbol(path, source, node, "class");
      if (record) {
        symbols.push(record);
        symbolNodes.push({ node, record });
      }
      return;
    }

    if (node.type === "module") {
      const record = extractClassOrModuleSymbol(path, source, node, "module");
      if (record) {
        symbols.push(record);
        symbolNodes.push({ node, record });
      }
      return;
    }

    if (node.type === "method") {
      const record = extractMethodSymbol(path, source, node, false);
      if (record) {
        symbols.push(record);
        symbolNodes.push({ node, record });
      }
      return;
    }

    if (node.type === "singleton_method") {
      const record = extractMethodSymbol(path, source, node, true);
      if (record) {
        symbols.push(record);
        symbolNodes.push({ node, record });
      }
      return;
    }

    if (node.type === "assignment") {
      const record = extractConstantSymbol(path, source, node);
      if (record) {
        symbols.push(record);
        symbolNodes.push({ node, record });
      }
    }
  });

  const localSymbols = new Map<string, SymbolRecord>();
  for (const symbol of symbols) {
    if (symbol.kind === "class" || symbol.kind === "module" || symbol.kind === "method" || symbol.kind === "constant") {
      localSymbols.set(symbol.name, symbol);
    }
  }

  for (const owner of symbolNodes) {
    const importRelations = owner.record.kind === "import"
      ? owner.record.relations ?? []
      : [];
    owner.record.relations = [
      ...(owner.record.relations ?? importRelations),
      ...extractUsesForSymbol(source, owner, path, availablePaths, aliases, localSymbols)
    ];
  }

  if (symbols.length > 0) {
    return symbols;
  }

  return fallbackRecord(path, source, "Fallback record created because no Ruby symbols were extracted.");
}
