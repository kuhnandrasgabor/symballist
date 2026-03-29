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
  positionals: string[];
};

function usage(): void {
  console.log(`symballist

Usage:
  bun run src/cli.ts init [--root PATH]
  bun run src/cli.ts index [--root PATH]
  bun run src/cli.ts status [--root PATH]
  bun run src/cli.ts show <id> [--root PATH]
  bun run src/cli.ts query "<text>" [--limit N] [--root PATH]
`);
}

export function parseCliArgs(argv: string[]): CliArgs {
  const positionals: string[] = [];
  let root = cwd();
  let limit = 10;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") {
      root = argv[index + 1] ?? root;
      index += 1;
      continue;
    }
    if (value === "--limit") {
      limit = Number(argv[index + 1]) || 10;
      index += 1;
      continue;
    }
    positionals.push(value);
  }

  return {
    command: positionals[0] ?? null,
    root,
    limit,
    positionals
  };
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

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
      const id = parsed.positionals[1] ?? "";
      await runShow(parsed.root, id);
      return;
    }
    case "query": {
      const query = parsed.positionals.slice(1).join(" ");
      await runQuery(parsed.root, query, parsed.limit);
      return;
    }
    default:
      usage();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
