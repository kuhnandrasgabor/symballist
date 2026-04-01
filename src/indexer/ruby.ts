import { dirname, join, normalize } from "node:path";
import Parser from "tree-sitter";
import Ruby from "tree-sitter-ruby";
import type { SyntaxNode } from "tree-sitter";
import type { RelationDetails, SymbolRecord } from "../types.ts";
import { MAX_TREE_SITTER_SOURCE_CHARS, oversizedFallbackReason } from "./oversized.ts";

const parser = new Parser();
parser.setLanguage(Ruby);

type UsageTarget = {
  targetPath: string;
  labelPrefix: string;
};

type RubySymbolNode = {
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

function rubyAutoloadCandidatePaths(relativeSegments: string[], sourcePath: string): string[] {
  const relativePath = join(...relativeSegments.map((segment) => snakeCaseRubySegment(segment)));

  return [
    normalize(join("app", "models", `${relativePath}.rb`)),
    normalize(join("app", "services", `${relativePath}.rb`)),
    normalize(join("app", "controllers", `${relativePath}.rb`)),
    normalize(join("app", "helpers", `${relativePath}.rb`)),
    normalize(join("app", "jobs", `${relativePath}.rb`)),
    normalize(join("app", "workers", `${relativePath}.rb`)),
    normalize(join("app", "mailers", `${relativePath}.rb`)),
    normalize(join("app", "serializers", `${relativePath}.rb`)),
    normalize(join("app", "policies", `${relativePath}.rb`)),
    normalize(join("lib", `${relativePath}.rb`)),
    normalize(`${relativePath}.rb`)
  ];
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

  const resolved = new Map<string, string>();
  for (const candidateSegments of candidateSegmentSets) {
    for (const candidatePath of rubyAutoloadCandidatePaths(candidateSegments, sourcePath)) {
      if (availablePaths.has(candidatePath)) {
        resolved.set(candidatePath, candidateSegments.join("::"));
      }
    }
  }

  if (resolved.size !== 1) {
    return null;
  }

  const [targetPath, labelPrefix] = [...resolved.entries()][0];
  return {
    targetPath,
    labelPrefix
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

  visit(owner.node, (node) => {
    if (node.type !== "call") {
      if (node.type === "constant" || node.type === "scope_resolution") {
        const reference = identifierText(source, node);
        const resolvedTarget = resolveRubyConstantPath(reference, sourcePath, availablePaths, lexicalNamespace);
        if (resolvedTarget && resolvedTarget.targetPath !== owner.record.path) {
          pushRelation({
            kind: "uses",
            targetPath: resolvedTarget.targetPath,
            targetLabel: resolvedTarget.labelPrefix
          });
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
        targetLabel: resolvedConstantTarget.labelPrefix
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
    return fallbackRecord(
      path,
      source,
      oversizedFallbackReason("Ruby")
    );
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
