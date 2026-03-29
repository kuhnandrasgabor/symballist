import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runIndex } from "../src/commands/index.ts";
import { runInit } from "../src/commands/init.ts";
import { openDatabase, searchSymbols } from "../src/db.ts";
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

describe("symballist vertical slice", () => {
  test("initializes repo-local state", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const db = await openDatabase(root);
    db.close();
    expect(await Bun.file(join(root, ".symballist", "config.json")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "index.db")).exists()).toBeTrue();
  });

  test("indexes Python and HTML fixtures and returns lexical results", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const stats = await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greetResults = searchSymbols(db, "greet", 5);
    const htmlResults = searchSymbols(db, "search OR panel", 5);
    const fallbackResults = searchSymbols(db, "No OR ids", 5);
    db.close();

    expect(stats.discoveredFiles).toBe(4);
    expect(stats.indexedFiles).toBe(4);
    expect(stats.skippedFiles).toBe(0);
    expect(greetResults.some((result) => result.name === "greet")).toBeTrue();
    expect(htmlResults.some((result) => result.name === "search-panel")).toBeTrue();
    expect(fallbackResults.some((result) => result.fallback)).toBeTrue();
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

  test("cli args accept an explicit root path", () => {
    const parsed = parseCliArgs(["query", "greet", "--root", "D:/Projects/co-ma", "--limit", "3"]);
    expect(parsed.command).toBe("query");
    expect(parsed.root).toBe("D:/Projects/co-ma");
    expect(parsed.limit).toBe(3);
    expect(parsed.positionals).toEqual(["query", "greet"]);
  });
});

