#!/usr/bin/env bun

import { cwd } from "node:process";
import { runIndex } from "./commands/index.ts";
import { runInit } from "./commands/init.ts";
import { runQuery } from "./commands/query.ts";
import { runShow } from "./commands/show.ts";
import { runStatus } from "./commands/status.ts";

export type CliArgs = {
  command: string | null;
  root: string;
  limit: number;
  kinds: string[];
  showName: string | null;
  positionals: string[];
  helpRequested: boolean;
  error: string | null;
};

function usage(): void {
  console.log(`symballist

Usage:
  symballist --help
  symballist init [--root PATH]
  symballist index [--root PATH]
  symballist status [--root PATH]
  symballist show <id> [--root PATH]
  symballist show --name <symbol> [--root PATH]
  symballist query "<text>" [--limit N|--top N] [--kind class,function] [--root PATH]
`);
}

function commandUsage(command: string): void {
  switch (command) {
    case "init":
      console.log("Usage:\n  symballist init [--root PATH]");
      return;
    case "index":
      console.log("Usage:\n  symballist index [--root PATH]");
      return;
    case "status":
      console.log("Usage:\n  symballist status [--root PATH]");
      return;
    case "show":
      console.log("Usage:\n  symballist show <id> [--root PATH]\n  symballist show --name <symbol> [--root PATH]");
      return;
    case "query":
      console.log("Usage:\n  symballist query \"<text>\" [--limit N|--top N] [--kind class,function] [--root PATH]");
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
  const kinds: string[] = [];
  let showName: string | null = null;
  let helpRequested = false;
  let error: string | null = null;
  let command: string | null = null;
  const positionals: string[] = [];

  if (argv.length === 0) {
    return {
      command: null,
      root,
      limit,
      kinds,
      showName,
      positionals,
      helpRequested: false,
      error: null
    };
  }

  const first = argv[0];
  if (first === "--help" || first === "-h") {
    return {
      command: null,
      root,
      limit,
      kinds,
      showName,
      positionals,
      helpRequested: true,
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
    if (command === "query" && (value === "--limit" || value === "--top")) {
      const parsed = parseNumberOption("--limit", argv[index + 1]);
      if (parsed === null) {
        error = `Expected a positive number after ${value}.`;
        break;
      }
      limit = parsed;
      index += 1;
      continue;
    }
    if (command === "query" && value === "--kind") {
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
    if (command === "show" && value === "--name") {
      const next = argv[index + 1];
      if (!next) {
        error = "Expected a symbol name after --name.";
        break;
      }
      showName = next;
      index += 1;
      continue;
    }
    if (value.startsWith("-")) {
      error = buildUnknownOptionError(command, value);
      break;
    }
    positionals.push(value);
  }

  return {
    command,
    root,
    limit,
    kinds,
    showName,
    positionals,
    helpRequested,
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
      await runInit(parsed.root);
      return;
    case "index":
      await runIndex(parsed.root);
      return;
    case "status":
      await runStatus(parsed.root);
      return;
    case "show": {
      const id = parsed.positionals[0] ?? "";
      await runShow(parsed.root, id, parsed.showName ?? undefined);
      return;
    }
    case "query": {
      const query = parsed.positionals.join(" ");
      await runQuery(parsed.root, query, parsed.limit, parsed.kinds);
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
