#!/usr/bin/env bun

import { cwd } from "node:process";
import { runGraph } from "./commands/graph.ts";
import { runIndex } from "./commands/index.ts";
import { runInit } from "./commands/init.ts";
import { runLookup } from "./commands/lookup.ts";
import { runQuery } from "./commands/query.ts";
import { runReport } from "./commands/report.ts";
import { runShow } from "./commands/show.ts";
import { runStatus } from "./commands/status.ts";
import { runWatch } from "./commands/watch.ts";
import type { SetupType, SupportedLanguage } from "./config.ts";
import { parseLanguageSelection } from "./fs.ts";

export type CliArgs = {
  command: string | null;
  root: string;
  limit: number;
  compactOutput: boolean;
  rebuildIndex: boolean;
  watchIntervalMs: number;
  watchOnce: boolean;
  kinds: string[];
  codeOnly: boolean;
  docsOnly: boolean;
  excludeTests: boolean;
  excludePaths: string[];
  preferImplementation: boolean;
  showName: string | null;
  showFull: boolean;
  positionals: string[];
  helpRequested: boolean;
  setupType: SetupType | null;
  languages: SupportedLanguage[] | null;
  autoDetectLanguages: boolean;
  error: string | null;
};

function usage(): void {
  console.log(`symballist

Usage:
  symballist --help
  symballist init [--root PATH] [--setup-type cli|tool|hybrid] [--languages auto|python,ruby,...]
  symballist index [--root PATH] [--rebuild]
  symballist watch [--root PATH] [--interval-ms N] [--once]
  symballist status [--root PATH]
  symballist report [--root PATH]
  symballist lookup "<text>" [--limit N|--top N] [--kind class,function] [--code-only|--docs-only] [--exclude-tests] [--exclude-path TEXT] [--prefer-implementation] [--full] [--compact] [--root PATH]
  symballist graph <id> [--full] [--compact] [--root PATH]
  symballist graph --name <symbol> [--full] [--compact] [--root PATH]
  symballist show <id|symbol> [--full] [--compact] [--root PATH]
  symballist show --name <symbol> [--full] [--compact] [--root PATH]
  symballist query "<text>" [--limit N|--top N] [--kind class,function] [--code-only|--docs-only] [--exclude-tests] [--exclude-path TEXT] [--prefer-implementation] [--compact] [--root PATH]

Command intent:
  query   ranked candidate exploration when you want to inspect multiple hits
  lookup  best-match-plus-context in one response, with alternatives included
  graph   direct traversal of indexed imports, uses, inbound neighbors, and containers
  show    direct inspection of a known id or symbol name; large bodies summarize unless --full
  report  opt-in local usage and impact summary for Symballist command flows

Runtime contract:
  repo-local tool-definition JSON on disk does not make symballist_* callable by itself
  if your runtime has not actually loaded those tools, use symballist or the repo-local wrapper immediately
  start with status; if stale or indexCompatibility.requiresRebuild, run watch --once or index --rebuild; then proceed with lookup/query/show/graph
`);
}

function commandUsage(command: string): void {
  switch (command) {
    case "init":
      console.log("Usage:\n  symballist init [--root PATH] [--setup-type cli|tool|hybrid] [--languages auto|python,ruby,...]\n\nSetup flow: initializes repo-local state, writes .symballist/scope.txt as the editable scope-control file, detects or records enabled languages, scaffolds repo-local profile folders, and bootstraps wrappers/instructions for the selected integration mode.");
      return;
    case "index":
      console.log("Usage:\n  symballist index [--root PATH] [--rebuild]\n\nIndex flow: performs an incremental-aware pass by default. Use --rebuild to force a full reindex when extractor/storage behavior changed or status reports indexCompatibility.requiresRebuild.");
      return;
    case "watch":
      console.log("Usage:\n  symballist watch [--root PATH] [--interval-ms N] [--once]\n\nRefresh flow: --once performs a one-shot freshness sweep and may legitimately no-op when auto-watch already kept the repo fresh. Scope-rule changes in .symballist/scope.txt also count as stale and are reapplied here.");
      return;
    case "status":
      console.log("Usage:\n  symballist status [--root PATH]\n\nHealth flow: inspect freshness, index compatibility, repo scope-control, embeddings, graph awareness, and shell guidance for the current repo. This is the mandatory first step before trusting older retrieval output.");
      return;
    case "report":
      console.log("Usage:\n  symballist report [--root PATH]\n\nImpact flow: read the opt-in repo-local Symballist usage and workflow-impact summary. The first slice stores aggregate command outcomes only and does not store raw query text.");
      return;
    case "lookup":
      console.log("Usage:\n  symballist lookup \"<text>\" [--limit N|--top N] [--kind class,function] [--code-only|--docs-only] [--exclude-tests] [--exclude-path TEXT] [--prefer-implementation] [--full] [--compact] [--root PATH]\n\nBest-match flow: returns one selected result with symbol context, graph diagnostics, relations, body presentation, and alternatives. Use this for exact symbols, config paths, CSS selectors from real .css files, and other one-shot lookups.");
      return;
    case "graph":
      console.log("Usage:\n  symballist graph <id> [--full] [--compact] [--root PATH]\n  symballist graph --name <symbol> [--full] [--compact] [--root PATH]\n\nTraversal flow: resolve a known symbol and return grouped graph neighbors such as imports, uses, importedBy, usedBy, and containedIn. Neighbor bodies summarize by default; use --full to expand neighbor bodies inline.");
      return;
    case "show":
      console.log("Usage:\n  symballist show <id|symbol> [--full] [--compact] [--root PATH]\n  symballist show --name <symbol> [--full] [--compact] [--root PATH]\n\nInspection flow: resolve a known symbol directly with graph diagnostics, relations, and body presentation. A non-numeric positional value is treated as a symbol name. Large bodies summarize by default; use --full when bodyPresentation says a fuller body is available.");
      return;
    case "query":
      console.log("Usage:\n  symballist query \"<text>\" [--limit N|--top N] [--kind class,function] [--code-only|--docs-only] [--exclude-tests] [--exclude-path TEXT] [--prefer-implementation] [--compact] [--root PATH]\n\nExploration flow: returns ranked candidates plus lightweight fileGroups context for manual inspection. Use this for fuzzy concepts and broader exploration; use lookup when you want the best hit already resolved.");
      return;
    default:
      usage();
  }
}

function parseNumberOption(name: string, rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function buildUnknownOptionError(command: string | null, option: string): string {
  if (command) {
    return `Unknown option ${option} for ${command}. Run "symballist ${command} --help" for usage.`;
  }
  return `Unknown option ${option}. Run "symballist --help" for usage.`;
}

export function parseCliArgs(argv: string[]): CliArgs {
  let root = cwd();
  let limit = 5;
  let compactOutput = false;
  let rebuildIndex = false;
  let watchIntervalMs = 2000;
  let watchOnce = false;
  const kinds: string[] = [];
  let codeOnly = false;
  let docsOnly = false;
  let excludeTests = false;
  const excludePaths: string[] = [];
  let preferImplementation = false;
  let showName: string | null = null;
  let showFull = false;
  let helpRequested = false;
  let setupType: SetupType | null = null;
  let languages: SupportedLanguage[] | null = null;
  let autoDetectLanguages = false;
  let error: string | null = null;
  let command: string | null = null;
  const positionals: string[] = [];

  if (argv.length === 0) {
    return {
      command: null,
      root,
      limit,
      compactOutput,
      rebuildIndex,
      watchIntervalMs,
      watchOnce,
      kinds,
      codeOnly,
      docsOnly,
      excludeTests,
      excludePaths,
      preferImplementation,
      showName,
      showFull,
      positionals,
      helpRequested: false,
      setupType,
      languages,
      autoDetectLanguages,
      error: null
    };
  }

  const first = argv[0];
  if (first === "--help" || first === "-h") {
    return {
      command: null,
      root,
      limit,
      compactOutput,
      rebuildIndex,
      watchIntervalMs,
      watchOnce,
      kinds,
      codeOnly,
      docsOnly,
      excludeTests,
      excludePaths,
      preferImplementation,
      showName,
      showFull,
      positionals,
      helpRequested: true,
      setupType,
      languages,
      autoDetectLanguages,
      error: null
    };
  }

  command = first ?? null;

  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      helpRequested = true;
      continue;
    }
    if (value === "--root") {
      const next = argv[index + 1];
      if (!next) {
        error = "Missing value for --root.";
        break;
      }
      root = next;
      index += 1;
      continue;
    }
    if (command === "init" && value === "--setup-type") {
      const next = argv[index + 1];
      if (!next || !["cli", "tool", "hybrid"].includes(next)) {
        error = "Expected one of cli, tool, or hybrid after --setup-type.";
        break;
      }
      setupType = next as SetupType;
      index += 1;
      continue;
    }
    if (command === "init" && value === "--languages") {
      const next = argv[index + 1];
      if (!next) {
        error = "Missing value for --languages.";
        break;
      }
      try {
        const parsed = parseLanguageSelection(next);
        if (parsed === "auto") {
          autoDetectLanguages = true;
          languages = null;
        } else {
          languages = parsed;
          autoDetectLanguages = false;
        }
      } catch (parseError) {
        error = parseError instanceof Error ? parseError.message : String(parseError);
        break;
      }
      index += 1;
      continue;
    }
    if (command === "index" && value === "--rebuild") {
      rebuildIndex = true;
      continue;
    }
    if (command === "watch" && value === "--interval-ms") {
      const parsed = parseNumberOption("--interval-ms", argv[index + 1]);
      if (parsed === null) {
        error = "Expected a positive number after --interval-ms.";
        break;
      }
      watchIntervalMs = parsed;
      index += 1;
      continue;
    }
    if (command === "watch" && value === "--once") {
      watchOnce = true;
      continue;
    }
    if ((command === "query" || command === "lookup") && (value === "--limit" || value === "--top")) {
      const parsed = parseNumberOption("--limit", argv[index + 1]);
      if (parsed === null) {
        error = `Expected a positive number after ${value}.`;
        break;
      }
      limit = parsed;
      index += 1;
      continue;
    }
    if ((command === "query" || command === "lookup") && value === "--kind") {
      const next = argv[index + 1];
      if (!next) {
        error = "Expected a comma-separated value after --kind.";
        break;
      }
      const parsedKinds = (argv[index + 1] ?? "")
        .split(",")
        .map((kind) => kind.trim())
        .filter(Boolean);
      kinds.push(...parsedKinds);
      index += 1;
      continue;
    }
    if ((command === "query" || command === "lookup") && value === "--code-only") {
      codeOnly = true;
      continue;
    }
    if ((command === "query" || command === "lookup") && value === "--docs-only") {
      docsOnly = true;
      continue;
    }
    if ((command === "query" || command === "lookup") && value === "--exclude-tests") {
      excludeTests = true;
      continue;
    }
    if ((command === "query" || command === "lookup") && value === "--exclude-path") {
      const next = argv[index + 1];
      if (!next) {
        error = "Expected a path fragment after --exclude-path.";
        break;
      }
      excludePaths.push(next);
      index += 1;
      continue;
    }
    if ((command === "query" || command === "lookup") && value === "--prefer-implementation") {
      preferImplementation = true;
      continue;
    }
    if ((command === "query" || command === "lookup" || command === "show" || command === "graph") && value === "--compact") {
      compactOutput = true;
      continue;
    }
    if ((command === "lookup" || command === "graph") && value === "--full") {
      showFull = true;
      continue;
    }
    if ((command === "show" || command === "graph") && value === "--name") {
      const next = argv[index + 1];
      if (!next) {
        error = "Expected a symbol name after --name.";
        break;
      }
      showName = next;
      index += 1;
      continue;
    }
    if (command === "show" && value === "--full") {
      showFull = true;
      continue;
    }
    if (value.startsWith("-")) {
      error = buildUnknownOptionError(command, value);
      break;
    }
    positionals.push(value);
  }

  if (codeOnly && docsOnly) {
    error = "Choose only one of --code-only or --docs-only.";
  }

  if (command === "show" && !showName && positionals.length > 0) {
    const candidate = positionals.join(" ").trim();
    const numericCandidate = Number(candidate);
    if (!Number.isInteger(numericCandidate) || numericCandidate <= 0) {
      showName = candidate;
      positionals.length = 0;
    }
  }

  return {
    command,
    root,
    limit,
    compactOutput,
    rebuildIndex,
    watchIntervalMs,
    watchOnce,
    kinds,
    codeOnly,
    docsOnly,
    excludeTests,
    excludePaths,
    preferImplementation,
    showName,
    showFull,
    positionals,
    helpRequested,
    setupType,
    languages,
    autoDetectLanguages,
    error
  };
}

export async function runCli(argv: string[]): Promise<void> {
  const parsed = parseCliArgs(argv);

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  if (parsed.helpRequested) {
    if (parsed.command) {
      commandUsage(parsed.command);
    } else {
      usage();
    }
    return;
  }

  switch (parsed.command) {
    case "init":
      await runInit(parsed.root, parsed.setupType ?? undefined, {
        languages: parsed.languages ?? undefined,
        autoDetectLanguages: parsed.autoDetectLanguages
      });
      return;
    case "index":
      await runIndex(parsed.root, { rebuild: parsed.rebuildIndex });
      return;
    case "watch":
      await runWatch(parsed.root, {
        intervalMs: parsed.watchIntervalMs,
        once: parsed.watchOnce
      });
      return;
    case "status":
      await runStatus(parsed.root);
      return;
    case "report":
      await runReport(parsed.root);
      return;
    case "lookup": {
      const query = parsed.positionals.join(" ");
      await runLookup(parsed.root, query, parsed.limit, parsed.kinds, {
        codeOnly: parsed.codeOnly,
        docsOnly: parsed.docsOnly,
        excludeTests: parsed.excludeTests,
        excludePaths: parsed.excludePaths,
        preferImplementation: parsed.preferImplementation
      }, {
        full: parsed.showFull,
        compact: parsed.compactOutput
      });
      return;
    }
    case "show": {
      const id = parsed.positionals[0] ?? "";
      await runShow(parsed.root, id, parsed.showName ?? undefined, {
        full: parsed.showFull,
        compact: parsed.compactOutput
      });
      return;
    }
    case "graph": {
      const id = parsed.positionals[0] ?? "";
      await runGraph(parsed.root, id, parsed.showName ?? undefined, {
        compact: parsed.compactOutput,
        full: parsed.showFull
      });
      return;
    }
    case "query": {
      const query = parsed.positionals.join(" ");
      await runQuery(parsed.root, query, parsed.limit, parsed.kinds, {
        codeOnly: parsed.codeOnly,
        docsOnly: parsed.docsOnly,
        excludeTests: parsed.excludeTests,
        excludePaths: parsed.excludePaths,
        preferImplementation: parsed.preferImplementation
      }, {
        compact: parsed.compactOutput
      });
      return;
    }
    case null:
      usage();
      return;
    default:
      throw new Error(`Unknown command ${parsed.command}. Run "symballist --help" for usage.`);
  }
}

async function main(): Promise<void> {
  await runCli(process.argv.slice(2));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
