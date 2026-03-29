#!/usr/bin/env bun

import { cwd } from "node:process";
import { runIndex } from "./commands/index.ts";
import { runInit } from "./commands/init.ts";
import { runQuery } from "./commands/query.ts";

function usage(): void {
  console.log(`symballist

Usage:
  bun run src/cli.ts init
  bun run src/cli.ts index
  bun run src/cli.ts query "<text>" [--limit N]
`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  const root = cwd();

  switch (command) {
    case "init":
      await runInit(root);
      return;
    case "index":
      await runIndex(root);
      return;
    case "query": {
      const query = args.find((value) => !value.startsWith("--")) ?? "";
      const limitIndex = args.findIndex((value) => value === "--limit");
      const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) || 10 : 10;
      await runQuery(root, query, limit);
      return;
    }
    default:
      usage();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
