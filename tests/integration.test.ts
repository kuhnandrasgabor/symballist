import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runIndex } from "../src/commands/index.ts";
import { runInit } from "../src/commands/init.ts";
import { runQuery } from "../src/commands/query.ts";
import { runShow } from "../src/commands/show.ts";
import { runStatus } from "../src/commands/status.ts";
import { buildFtsQuery, getBestSymbolByName, getRelatedSymbolsForSymbol, getRelationsForSymbol, getSymbolById, openDatabase, searchSymbols } from "../src/db.ts";
import { fileMetadata, listSourceFiles } from "../src/fs.ts";
import { detectIndexFreshness } from "../src/freshness.ts";
import { parseCliArgs, runCli } from "../src/cli.ts";

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
    expect(await Bun.file(join(root, ".symballist", "bin", "symballist.cmd")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "bin", "symballist.ps1")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "bin", "symballist")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "instructions", "symballist-adoption.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "instructions", "AGENTS.symballist.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "instructions", "CLAUDE.symballist.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, "AGENTS.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, "CLAUDE.md")).exists()).toBeTrue();
  });

  test("init bootstraps managed agent instructions idempotently", async () => {
    const root = await createFixtureRepo();
    await writeFile(join(root, "AGENTS.md"), "# Project Notes\n", "utf8");
    await writeFile(join(root, "CLAUDE.md"), "# Claude Notes\n", "utf8");

    await runInit(root);
    await runInit(root);

    const agentsText = await readFile(join(root, "AGENTS.md"), "utf8");
    const claudeText = await readFile(join(root, "CLAUDE.md"), "utf8");
    const wrapperCmd = await readFile(join(root, ".symballist", "bin", "symballist.cmd"), "utf8");
    const localAgentsSnippet = await readFile(join(root, ".symballist", "instructions", "AGENTS.symballist.md"), "utf8");
    const localGuide = await readFile(join(root, ".symballist", "instructions", "symballist-adoption.md"), "utf8");

    expect(agentsText).toContain("# Project Notes");
    expect(claudeText).toContain("# Claude Notes");
    expect(agentsText.match(/<!-- SYMBALLIST RETRIEVAL START -->/g)?.length ?? 0).toBe(1);
    expect(claudeText.match(/<!-- SYMBALLIST RETRIEVAL START -->/g)?.length ?? 0).toBe(1);
    expect(agentsText).toContain(`.symballist\\bin\\symballist.cmd status --root ${root}`);
    expect(claudeText).toContain(`.symballist\\bin\\symballist.cmd status --root ${root}`);
    expect(localAgentsSnippet).toContain(`.symballist\\bin\\symballist.cmd query "<text>" --root ${root}`);
    expect(localGuide).toContain(`.symballist\\bin\\symballist.cmd index --root ${root}`);
    expect(wrapperCmd).toContain('bun "D:\\Projects\\symballist\\src\\cli.ts" %*');
    expect(localGuide).not.toContain("<PROJECT_ROOT>");
    expect(localGuide).not.toContain("<SYMBALLIST_ROOT>");
  });

  test("indexes fixtures and returns rich lexical query results", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const stats = await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greetResults = searchSymbols(db, "greet", 5);
    const htmlResults = searchSymbols(db, "search OR panel", 5);
    const fallbackResults = searchSymbols(db, "No OR ids", 5);
    const markdownResults = searchSymbols(db, "backlog", 5);
    db.close();

    const greet = greetResults.find((result) => result.name === "greet");
    const searchPanel = htmlResults.find((result) => result.name === "search-panel");
    const fallback = fallbackResults.find((result) => result.fallback);
    const markdownHeading = markdownResults.find((result) => result.kind === "heading");

    expect(stats.discoveredFiles).toBe(7);
    expect(stats.indexedFiles).toBe(7);
    expect(stats.skippedFiles).toBe(0);
    expect(greet).toBeDefined();
    expect(greet?.startLine).toBe(5);
    expect(greet?.startColumn).toBe(5);
    expect(greet?.snippet).toContain("def greet");
    expect(greet?.distance).toBeLessThan(0);
    expect(greet?.confidence).toBe("exact");
    expect(greet?.matchReason).toBe("exact_symbol_name");
    expect(greet?.extraction).toBe("parsed");
    expect(greet?.trustLevel).toBe("high");
    expect(searchPanel).toBeDefined();
    expect(searchPanel?.startLine).toBe(8);
    expect(searchPanel?.snippet).toContain("search-panel");
    expect(fallback).toBeDefined();
    expect(fallback?.startLine).toBe(1);
    expect(fallback?.snippet).toContain("No ids here");
    expect(markdownHeading).toBeDefined();
    expect(markdownHeading?.name).toBe("Backlog Workflow");
    expect(markdownHeading?.path).toBe("workflow.md");
    expect(markdownHeading?.snippet).toContain("backlog CLI");
  });

  test("repeated index runs skip unchanged files", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const first = await runIndex(root, { progress: false });
    const second = await runIndex(root, { progress: false });

    expect(first.indexedFiles).toBe(7);
    expect(first.skippedFiles).toBe(0);
    expect(second.indexedFiles).toBe(0);
    expect(second.skippedFiles).toBe(7);
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
    expect(stats.skippedFiles).toBe(6);
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
      indexFreshness: {
        stale: boolean;
        changedFiles: number;
        newFiles: number;
        deletedFiles: number;
      };
    };

    expect(status.initialized).toBeTrue();
    expect(status.dbExists).toBeTrue();
    expect(status.supportedLanguages).toEqual(["html", "markdown", "python"]);
    expect(status.indexedFiles).toBe(7);
    expect(status.indexedSymbols).toBe(13);
    expect(status.fallbackSymbols).toBe(1);
    expect(status.indexedSchemaVersion).toBeGreaterThan(0);
    expect(status.indexFreshness.stale).toBeFalse();
  });

  test("show resolves a queried symbol id into full stored context", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greet = searchSymbols(db, "greet", 5).find((result) => result.name === "greet");
    const fromDb = greet ? getSymbolById(db, greet.id) : null;
    const relationsFromDb = fromDb ? getRelationsForSymbol(db, fromDb) : [];
    const relatedFromDb = fromDb ? getRelatedSymbolsForSymbol(db, fromDb) : [];
    db.close();

    expect(greet).toBeDefined();
    expect(fromDb).toBeDefined();
    expect(fromDb?.body).toContain('return f"Hello, {name}"');
    expect(fromDb?.startLine).toBe(5);
    expect(fromDb?.endLine).toBe(6);
    expect(fromDb?.extraction).toBe("parsed");
    expect(fromDb?.trustLevel).toBe("high");
    expect(relationsFromDb.some((relation) => relation.kind === "contained_in" && relation.targetPath === "app.py")).toBeTrue();
    expect(relationsFromDb.some((relation) => relation.kind === "imports" && relation.targetPath === "helpers.py")).toBeTrue();
    expect(relatedFromDb.some((entry) => entry.symbol.name === "Greeter" && entry.relation.kind === "contained_in")).toBeTrue();
    expect(relatedFromDb.some((entry) => entry.symbol.name === "slugify" && entry.relation.kind === "imports")).toBeTrue();

    const output = await captureConsoleLog(async () => {
      await runShow(root, String(greet?.id));
    });
    const shown = JSON.parse(output) as {
      indexFreshness: { stale: boolean };
      bodyPresentation: {
        mode: string;
        truncated: boolean;
      };
      symbol: {
        id: number;
        name: string;
        body: string;
        extraction: string;
        trustLevel: string;
        startLine: number;
        endLine: number;
      };
      relations: Array<{
        kind: string;
        targetPath: string | null;
        targetLabel: string;
      }>;
      related: Array<{
        relation: {
          kind: string;
          targetPath: string | null;
          targetLabel: string;
        };
        symbol: {
          id: number;
          name: string;
          path: string;
        };
      }>;
    };

    expect(shown.indexFreshness.stale).toBeFalse();
    expect(shown.bodyPresentation.mode).toBe("full");
    expect(shown.bodyPresentation.truncated).toBeFalse();
    expect(shown.symbol.id).toBe(greet?.id);
    expect(shown.symbol.name).toBe("greet");
    expect(shown.symbol.body).toContain('return f"Hello, {name}"');
    expect(shown.symbol.extraction).toBe("parsed");
    expect(shown.symbol.trustLevel).toBe("high");
    expect(shown.symbol.startLine).toBe(5);
    expect(shown.symbol.endLine).toBe(6);
    expect(shown.relations.some((relation) => relation.kind === "contained_in" && relation.targetPath === "app.py")).toBeTrue();
    expect(shown.relations.some((relation) => relation.kind === "imports" && relation.targetPath === "helpers.py")).toBeTrue();
    expect(shown.related.some((entry) => entry.symbol.name === "Greeter" && entry.relation.kind === "contained_in")).toBeTrue();
    expect(shown.related.some((entry) => entry.symbol.name === "slugify" && entry.relation.kind === "imports")).toBeTrue();
  });

  test("show resolves exact symbol names without requiring an intermediate id", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greet = getBestSymbolByName(db, "greet");
    db.close();

    expect(greet).toBeDefined();

    const output = await captureConsoleLog(async () => {
      await runShow(root, "", "greet");
    });
    const shown = JSON.parse(output) as {
      symbol: {
        id: number;
        name: string;
      };
    };

    expect(shown.symbol.id).toBe(greet?.id);
    expect(shown.symbol.name).toBe("greet");
  });

  test("show summarizes very large symbol bodies by default and supports --full expansion", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    const largeBody = [
      "class MemoryStore:",
      "    \"\"\"Large body for summary testing.\"\"\"",
      ...Array.from({ length: 5000 }, (_, index) => `    field_${index} = ${index}`)
    ].join("\n");

    await writeFile(join(root, "src", "memory_store.py"), largeBody, "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    const summaryOutput = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "MemoryStore");
    })) as {
      bodyPresentation: {
        mode: string;
        truncated: boolean;
        totalLines: number;
        shownLines: number;
      };
      symbol: {
        body: string;
      };
    };

    const fullOutput = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "MemoryStore", { full: true });
    })) as {
      bodyPresentation: {
        mode: string;
        truncated: boolean;
      };
      symbol: {
        body: string;
      };
    };

    expect(summaryOutput.bodyPresentation.mode).toBe("summary");
    expect(summaryOutput.bodyPresentation.truncated).toBeTrue();
    expect(summaryOutput.bodyPresentation.totalLines).toBeGreaterThan(summaryOutput.bodyPresentation.shownLines);
    expect(summaryOutput.symbol.body).toContain("[truncated, rerun show with --full");
    expect(fullOutput.bodyPresentation.mode).toBe("full");
    expect(fullOutput.bodyPresentation.truncated).toBeFalse();
    expect(fullOutput.symbol.body).toContain("field_119");
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
      intent: {
        codeOnly?: boolean;
        docsOnly?: boolean;
        excludeTests?: boolean;
        preferImplementation?: boolean;
      };
      indexFreshness: { stale: boolean };
      resultSemantics: {
        distance: string;
        confidenceOrder: string[];
        trustLevels: string[];
      };
      results: Array<{
        kind: string;
        distance: number;
        confidence: string;
        matchReason: string;
        extraction: string;
        trustLevel: string;
      }>;
    };

    expect(queryPayload.kinds).toEqual(["import"]);
    expect(queryPayload.intent).toEqual({});
    expect(queryPayload.indexFreshness.stale).toBeFalse();
    expect(queryPayload.resultSemantics.distance).toBe("lower is better");
    expect(queryPayload.resultSemantics.confidenceOrder).toEqual(["exact", "strong", "related", "fallback"]);
    expect(queryPayload.results.length).toBeGreaterThan(0);
    expect(queryPayload.results.every((result) => result.kind === "import")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.distance === "number")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.confidence === "string")).toBeTrue();
    expect(queryPayload.results.every((result) => ["import_reference", "normalized_symbol_name"].includes(result.matchReason))).toBeTrue();
  });

  test("symbol-shaped queries prefer exact owning definitions over normalized references", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "tests"), { recursive: true });
    await writeFile(
      join(root, "src", "distiller.py"),
      'class DistillationEngine:\n    pass\n',
      "utf8"
    );
    await writeFile(
      join(root, "src", "helpers.py"),
      'from src.distiller import DistillationEngine\n\n\ndef distillation_engine() -> DistillationEngine:\n    return DistillationEngine()\n',
      "utf8"
    );
    await writeFile(
      join(root, "tests", "test_distiller.py"),
      'def test_distillation_engine_behavior():\n    assert "DistillationEngine"\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, buildFtsQuery("DistillationEngine"), 5, { rawQuery: "DistillationEngine" });
    db.close();

    expect(results[0]?.kind).toBe("class");
    expect(results[0]?.name).toBe("DistillationEngine");
    expect(results[0]?.path).toBe("src\\distiller.py");
    expect(results[0]?.confidence).toBe("exact");
    expect(results[0]?.matchReason).toBe("exact_symbol_name");
    expect(results.some((result) => result.name === "distillation_engine")).toBeTrue();
  });

  test("conceptual code queries prefer src implementations over tests while doc queries still favor docs", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "tests"), { recursive: true });
    await writeFile(
      join(root, "src", "memory.py"),
      'class MemoryStore:\n    pass\n',
      "utf8"
    );
    await writeFile(
      join(root, "tests", "test_memory.py"),
      'def test_memory_store_flow():\n    assert "memory store"\n',
      "utf8"
    );
    await writeFile(
      join(root, "architecture.md"),
      "# Architecture\n\nThe architecture document should rank ahead of incidental code mentions.\n",
      "utf8"
    );
    await writeFile(
      join(root, "src", "architecture.py"),
      'def architecture_helper() -> str:\n    return "architecture"\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const memoryResults = searchSymbols(db, buildFtsQuery("memory store"), 5, { rawQuery: "memory store" });
    const architectureResults = searchSymbols(db, buildFtsQuery("architecture"), 5, { rawQuery: "architecture" });
    db.close();

    expect(memoryResults[0]?.path).toBe("src\\memory.py");
    expect(memoryResults[0]?.language).toBe("python");
    expect(memoryResults.some((result) => result.path === "tests\\test_memory.py")).toBeTrue();
    expect(architectureResults[0]?.path).toBe("architecture.md");
    expect(architectureResults[0]?.language).toBe("markdown");
  });

  test("concept-oriented queries can promote canonical implementation symbols from matching source paths", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "tests"), { recursive: true });
    await writeFile(
      join(root, "src", "distiller.py"),
      'class DistillationEngine:\n    pass\n',
      "utf8"
    );
    await writeFile(
      join(root, "src", "gateway.py"),
      'from src.distiller import DistillationEngine\n\n\ndef build_distiller() -> DistillationEngine:\n    return DistillationEngine()\n',
      "utf8"
    );
    await writeFile(
      join(root, "tests", "test_distiller.py"),
      'def test_distiller_pipeline():\n    assert "distiller"\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, buildFtsQuery("distiller"), 5, {
      rawQuery: "distiller"
    });
    db.close();

    expect(results[0]?.path).toBe("src\\distiller.py");
    expect(results[0]?.name).toBe("DistillationEngine");
    expect(results[0]?.kind).toBe("class");
    expect(results[0]?.matchReason).toBe("path_concept");
    expect(results[0]?.confidence).toBe("strong");
    expect(results.some((result) => result.path === "tests\\test_distiller.py")).toBeTrue();
  });

  test("query-time trust and match reasons stay meaningful for recovered exact hits and loose token matches", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "tests"), { recursive: true });

    const oversizedStore = [
      "class MemoryStore:",
      "    pass",
      "",
      "# filler",
      "# filler\n".repeat(5000)
    ].join("\n");

    await writeFile(join(root, "src", "memory_store.py"), oversizedStore, "utf8");
    await writeFile(
      join(root, "tests", "test_memory.py"),
      'def test_memory_store_flow():\n    assert "memory store"\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const exactRecovered = searchSymbols(db, buildFtsQuery("memory store"), 5, {
      rawQuery: "memory store"
    });
    const looseToken = searchSymbols(db, buildFtsQuery("store flow"), 5, {
      rawQuery: "store flow"
    });
    db.close();

    const recoveredMemoryStore = exactRecovered.find((result) => result.name === "MemoryStore");
    expect(recoveredMemoryStore).toBeDefined();
    expect(recoveredMemoryStore?.confidence).toBe("exact");
    expect(recoveredMemoryStore?.matchReason).toBe("normalized_symbol_name");
    expect(recoveredMemoryStore?.extraction).toBe("recovered");
    expect(recoveredMemoryStore?.trustLevel).toBe("high");
    expect(looseToken.some((result) => result.matchReason === "token_overlap")).toBeTrue();
  });

  test("query intent flags can filter docs, exclude tests, and prefer implementation", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "tests"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "src", "memory_store.py"),
      'class MemoryStore:\n    """Core memory store implementation."""\n    pass\n',
      "utf8"
    );
    await writeFile(
      join(root, "src", "gateway.py"),
      'def build_memory_store() -> "MemoryStore":\n    return MemoryStore()\n',
      "utf8"
    );
    await writeFile(
      join(root, "tests", "test_memory.py"),
      'def test_memory_store_flow():\n    assert "memory store"\n',
      "utf8"
    );
    await writeFile(
      join(root, "docs", "memory.md"),
      '# Memory Store\n\nArchitecture notes for the memory store.\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const codeOnly = searchSymbols(db, buildFtsQuery("memory store"), 5, {
      rawQuery: "memory store",
      codeOnly: true
    });
    const docsOnly = searchSymbols(db, buildFtsQuery("memory store"), 5, {
      rawQuery: "memory store",
      docsOnly: true
    });
    const excludeTests = searchSymbols(db, buildFtsQuery("memory store"), 5, {
      rawQuery: "memory store",
      codeOnly: true,
      excludeTests: true
    });
    const preferImplementation = searchSymbols(db, buildFtsQuery("memory store"), 5, {
      rawQuery: "memory store",
      codeOnly: true,
      excludeTests: true,
      preferImplementation: true
    });
    db.close();

    expect(codeOnly.length).toBeGreaterThan(0);
    expect(codeOnly.every((result) => result.language !== "markdown")).toBeTrue();
    expect(docsOnly.length).toBeGreaterThan(0);
    expect(docsOnly.every((result) => result.language === "markdown")).toBeTrue();
    expect(excludeTests.every((result) => !result.path.startsWith("tests\\"))).toBeTrue();
    expect(preferImplementation[0]?.path).toBe("src\\memory_store.py");

    const payload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "memory store", 5, [], {
        codeOnly: true,
        excludeTests: true,
        preferImplementation: true
      });
    })) as {
      intent: {
        codeOnly: boolean;
        docsOnly?: boolean;
        excludeTests: boolean;
        preferImplementation: boolean;
      };
      results: Array<{ path: string }>;
    };

    expect(payload.intent.codeOnly).toBeTrue();
    expect(payload.intent.excludeTests).toBeTrue();
    expect(payload.intent.preferImplementation).toBeTrue();
    expect(payload.results[0]?.path).toBe("src\\memory_store.py");
  });

  test("status and query report stale indexes after source changes", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    await writeFile(join(root, "helpers.py"), 'def slugify(value: str) -> str:\n    return value.lower()\n', "utf8");

    const statusOutput = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(statusOutput) as {
      indexFreshness: {
        stale: boolean;
        changedFiles: number;
        newFiles: number;
        deletedFiles: number;
      };
    };

    const queryOutput = await captureConsoleLog(async () => {
      await runQuery(root, "slugify", 5);
    });
    const queryPayload = JSON.parse(queryOutput) as {
      indexFreshness: {
        stale: boolean;
        changedFiles: number;
        newFiles: number;
        deletedFiles: number;
      };
    };

    expect(status.indexFreshness.stale).toBeTrue();
    expect(status.indexFreshness.changedFiles).toBe(1);
    expect(status.indexFreshness.newFiles).toBe(0);
    expect(status.indexFreshness.deletedFiles).toBe(0);
    expect(queryPayload.indexFreshness.stale).toBeTrue();
    expect(queryPayload.indexFreshness.changedFiles).toBe(1);
  });

  test("freshness ignores tiny mtime jitter immediately after indexing", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const currentFiles = await listSourceFiles(root);
    const indexedFiles = await Promise.all(currentFiles.map(async (file) => {
      const metadata = await fileMetadata(file.absolutePath);
      return {
        path: file.relativePath,
        language: file.language,
        size: metadata.size,
        mtimeMs: metadata.mtimeMs + 5
      };
    }));

    const freshness = await detectIndexFreshness(root, indexedFiles);
    expect(freshness.stale).toBeFalse();
    expect(freshness.changedFiles).toBe(0);
  });

  test("oversized python files recover top-level symbols instead of a single file fallback", async () => {
    const root = await createFixtureRepo();
    const oversizedSource = [
      "from helpers import slugify",
      "",
      "class AgentConfig:",
      "    kind = 'agent'",
      "",
      "    def build(self) -> str:",
      "        return slugify(self.kind)",
      "",
      "def create_agent_config() -> AgentConfig:",
      "    return AgentConfig()",
      "",
      "# filler",
      "# filler\n".repeat(5000)
    ].join("\n");

    await writeFile(join(root, "big_models.py"), oversizedSource, "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, "AgentConfig", 10);
    const agentConfig = results.find((result) => result.name === "AgentConfig");
    const fileFallback = results.find((result) => result.path === "big_models.py" && result.kind === "file");
    const details = agentConfig ? getSymbolById(db, agentConfig.id) : null;
    db.close();

    expect(agentConfig).toBeDefined();
    expect(agentConfig?.kind).toBe("class");
    expect(agentConfig?.startLine).toBe(3);
    expect(agentConfig?.extraction).toBe("recovered");
    expect(agentConfig?.trustLevel).toBe("high");
    expect(fileFallback).toBeUndefined();
    expect(details?.body).toContain("class AgentConfig");
    expect(details?.endLine).toBeGreaterThan(agentConfig?.startLine ?? 0);
  });

  test("cli args accept an explicit root path", () => {
    const parsed = parseCliArgs(["query", "greet", "--root", "D:/Projects/co-ma", "--limit", "3", "--kind", "class,function"]);
    expect(parsed.command).toBe("query");
    expect(parsed.root).toBe("D:/Projects/co-ma");
    expect(parsed.limit).toBe(3);
    expect(parsed.kinds).toEqual(["class", "function"]);
    expect(parsed.showName).toBeNull();
    expect(parsed.positionals).toEqual(["greet"]);
    expect(parsed.helpRequested).toBeFalse();
    expect(parsed.error).toBeNull();
  });

  test("cli args support show by symbol name, query intent flags, and default to tighter query result counts", () => {
    const queryParsed = parseCliArgs(["query", "greet"]);
    expect(queryParsed.limit).toBe(5);
    expect(queryParsed.codeOnly).toBeFalse();
    expect(queryParsed.docsOnly).toBeFalse();

    const filteredQueryParsed = parseCliArgs([
      "query",
      "greet",
      "--code-only",
      "--exclude-tests",
      "--prefer-implementation"
    ]);
    expect(filteredQueryParsed.codeOnly).toBeTrue();
    expect(filteredQueryParsed.excludeTests).toBeTrue();
    expect(filteredQueryParsed.preferImplementation).toBeTrue();
    expect(filteredQueryParsed.docsOnly).toBeFalse();

    const conflictingQueryParsed = parseCliArgs(["query", "greet", "--code-only", "--docs-only"]);
    expect(conflictingQueryParsed.error).toContain("--code-only or --docs-only");

    const showParsed = parseCliArgs(["show", "--name", "greet", "--root", "D:/Projects/co-ma"]);
    expect(showParsed.command).toBe("show");
    expect(showParsed.showName).toBe("greet");
    expect(showParsed.showFull).toBeFalse();
    expect(showParsed.root).toBe("D:/Projects/co-ma");
    expect(showParsed.positionals).toEqual([]);
    expect(showParsed.error).toBeNull();

    const showFullParsed = parseCliArgs(["show", "--name", "greet", "--full"]);
    expect(showFullParsed.showFull).toBeTrue();
  });

  test("query help is handled as CLI help instead of query text", async () => {
    const parsed = parseCliArgs(["query", "--help"]);
    expect(parsed.command).toBe("query");
    expect(parsed.helpRequested).toBeTrue();
    expect(parsed.positionals).toEqual([]);
    expect(parsed.error).toBeNull();

    const output = await captureConsoleLog(async () => {
      await runCli(["query", "--help"]);
    });
    expect(output).toContain('symballist query "<text>"');
  });

  test("query accepts --top as a limit alias without reaching FTS with raw flag text", async () => {
    const parsed = parseCliArgs(["query", "--top", "5", "greet"]);
    expect(parsed.command).toBe("query");
    expect(parsed.limit).toBe(5);
    expect(parsed.positionals).toEqual(["greet"]);
    expect(parsed.error).toBeNull();
  });
});
