import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runIndex } from "../src/commands/index.ts";
import { runInit } from "../src/commands/init.ts";
import { runQuery } from "../src/commands/query.ts";
import { runShow } from "../src/commands/show.ts";
import { runStatus } from "../src/commands/status.ts";
import { getSymbolById, openDatabase, searchSymbols } from "../src/db.ts";
import { parseCliArgs } from "../src/cli.ts";

const tempRoots: string[] = [];

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

async function createFixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "symballist-"));
  tempRoots.push(root);
  await cp("fixtures/repos/mini-py-html", root, { recursive: true });
  await rm(join(root, ".symballist"), { recursive: true, force: true });
  return root;
}

async function captureConsoleLog(run: () => Promise<void>): Promise<string> {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...values: unknown[]) => {
    lines.push(values.map((value) => String(value)).join(" "));
  };

  try {
    await run();
  } finally {
    console.log = original;
  }

  return lines.join("\n");
}

describe("symballist vertical slice", () => {
  test("initializes repo-local state", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const db = await openDatabase(root);
    db.close();
    expect(await Bun.file(join(root, ".symballist", "config.json")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "index.db")).exists()).toBeTrue();
  });

  test("indexes fixtures and returns rich lexical query results", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const stats = await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greetResults = searchSymbols(db, "greet", 5);
    const htmlResults = searchSymbols(db, "search OR panel", 5);
    const fallbackResults = searchSymbols(db, "No OR ids", 5);
    db.close();

    const greet = greetResults.find((result) => result.name === "greet");
    const searchPanel = htmlResults.find((result) => result.name === "search-panel");
    const fallback = fallbackResults.find((result) => result.fallback);

    expect(stats.discoveredFiles).toBe(4);
    expect(stats.indexedFiles).toBe(4);
    expect(stats.skippedFiles).toBe(0);
    expect(greet).toBeDefined();
    expect(greet?.startLine).toBe(5);
    expect(greet?.startColumn).toBe(5);
    expect(greet?.snippet).toContain("def greet");
    expect(searchPanel).toBeDefined();
    expect(searchPanel?.startLine).toBe(8);
    expect(searchPanel?.snippet).toContain("search-panel");
    expect(fallback).toBeDefined();
    expect(fallback?.startLine).toBe(1);
    expect(fallback?.snippet).toContain("No ids here");
  });

  test("repeated index runs skip unchanged files", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const first = await runIndex(root, { progress: false });
    const second = await runIndex(root, { progress: false });

    expect(first.indexedFiles).toBe(4);
    expect(first.skippedFiles).toBe(0);
    expect(second.indexedFiles).toBe(0);
    expect(second.skippedFiles).toBe(4);
    expect(second.indexedSymbols).toBe(0);
  });

  test("changed files are re-indexed on subsequent runs", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    await writeFile(join(root, "helpers.py"), 'def slugify(value: str) -> str:\n    return value.upper()\n', "utf8");
    const stats = await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, "slugify", 5);
    db.close();

    expect(stats.indexedFiles).toBe(1);
    expect(stats.skippedFiles).toBe(3);
    expect(results.some((result) => result.name === "slugify")).toBeTrue();
  });

  test("status reports repo-local index health", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const output = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(output) as {
      initialized: boolean;
      dbExists: boolean;
      supportedLanguages: string[];
      indexedFiles: number;
      indexedSymbols: number;
      fallbackSymbols: number;
      indexedSchemaVersion: number | null;
    };

    expect(status.initialized).toBeTrue();
    expect(status.dbExists).toBeTrue();
    expect(status.supportedLanguages).toEqual(["html", "python"]);
    expect(status.indexedFiles).toBe(4);
    expect(status.indexedSymbols).toBe(9);
    expect(status.fallbackSymbols).toBe(1);
    expect(status.indexedSchemaVersion).toBeGreaterThan(0);
  });

  test("show resolves a queried symbol id into full stored context", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greet = searchSymbols(db, "greet", 5).find((result) => result.name === "greet");
    const fromDb = greet ? getSymbolById(db, greet.id) : null;
    db.close();

    expect(greet).toBeDefined();
    expect(fromDb).toBeDefined();
    expect(fromDb?.body).toContain('return f"Hello, {name}"');
    expect(fromDb?.startLine).toBe(5);
    expect(fromDb?.endLine).toBe(6);

    const output = await captureConsoleLog(async () => {
      await runShow(root, String(greet?.id));
    });
    const shown = JSON.parse(output) as {
      id: number;
      name: string;
      body: string;
      startLine: number;
      endLine: number;
    };

    expect(shown.id).toBe(greet?.id);
    expect(shown.name).toBe("greet");
    expect(shown.body).toContain('return f"Hello, {name}"');
    expect(shown.startLine).toBe(5);
    expect(shown.endLine).toBe(6);
  });

  test("query prefers declarations over imports and supports kind filters", async () => {
    const root = await createFixtureRepo();
    await writeFile(
      join(root, "models.py"),
      'class AgentConfig:\n    pass\n',
      "utf8"
    );
    await writeFile(
      join(root, "uses.py"),
      'from models import AgentConfig\n\n\ndef build_agent_config() -> AgentConfig:\n    return AgentConfig()\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const ranked = searchSymbols(db, "AgentConfig", 5);
    const importsOnly = searchSymbols(db, "AgentConfig", 5, { kinds: ["import"] });
    db.close();

    expect(ranked[0]?.kind).toBe("class");
    expect(ranked[0]?.name).toBe("AgentConfig");
    expect(importsOnly.length).toBeGreaterThan(0);
    expect(importsOnly.every((result) => result.kind === "import")).toBeTrue();

    const output = await captureConsoleLog(async () => {
      await runQuery(root, "AgentConfig", 5, ["import"]);
    });
    const queryPayload = JSON.parse(output) as {
      kinds: string[];
      results: Array<{ kind: string }>;
    };

    expect(queryPayload.kinds).toEqual(["import"]);
    expect(queryPayload.results.length).toBeGreaterThan(0);
    expect(queryPayload.results.every((result) => result.kind === "import")).toBeTrue();
  });

  test("cli args accept an explicit root path", () => {
    const parsed = parseCliArgs(["query", "greet", "--root", "D:/Projects/co-ma", "--limit", "3", "--kind", "class,function"]);
    expect(parsed.command).toBe("query");
    expect(parsed.root).toBe("D:/Projects/co-ma");
    expect(parsed.limit).toBe(3);
    expect(parsed.kinds).toEqual(["class", "function"]);
    expect(parsed.positionals).toEqual(["query", "greet"]);
  });
});
