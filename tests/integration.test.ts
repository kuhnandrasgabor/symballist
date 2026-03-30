import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runIndex } from "../src/commands/index.ts";
import { runInit } from "../src/commands/init.ts";
import { runLookup } from "../src/commands/lookup.ts";
import { runQuery } from "../src/commands/query.ts";
import { runShow } from "../src/commands/show.ts";
import { runStatus } from "../src/commands/status.ts";
import { runWatch } from "../src/commands/watch.ts";
import { buildFtsQuery, getBestSymbolByName, getRelatedSymbolsForSymbol, getRelationsForSymbol, getSymbolById, openDatabase, searchSymbols } from "../src/db.ts";
import { buildEmbeddingText } from "../src/embeddings.ts";
import { fileMetadata, listSourceFiles } from "../src/fs.ts";
import { readConfig, writeConfig } from "../src/fs.ts";
import { detectIndexFreshness } from "../src/freshness.ts";
import { parseCliArgs, runCli } from "../src/cli.ts";
import { detectShellFlavor, getShellGuidance } from "../src/shell.ts";

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

function normalizeRepoPath(value: string | null | undefined): string | null | undefined {
  return value?.replace(/\\/g, "/");
}

async function withMockFetch<T>(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
  run: () => Promise<T>
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    return handler(url, init);
  }) as typeof fetch;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    expect(await Bun.file(join(root, ".symballist", "tools", "symballist-tools.json")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "tools", "README.md")).exists()).toBeTrue();
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
    const toolManifest = await readFile(join(root, ".symballist", "tools", "symballist-tools.json"), "utf8");
    const gitignore = await readFile(join(root, ".gitignore"), "utf8");

    expect(agentsText).toContain("# Project Notes");
    expect(claudeText).toContain("# Claude Notes");
    expect(agentsText.match(/<!-- SYMBALLIST RETRIEVAL START -->/g)?.length ?? 0).toBe(1);
    expect(claudeText.match(/<!-- SYMBALLIST RETRIEVAL START -->/g)?.length ?? 0).toBe(1);
    expect(agentsText).toContain(".symballist\\tools\\symballist-tools.json");
    expect(claudeText).toContain(".symballist\\tools\\symballist-tools.json");
    expect(agentsText).toContain("./.symballist/bin/symballist");
    expect(claudeText).toContain("./.symballist/bin/symballist");
    expect(localAgentsSnippet).toContain("symballist_lookup");
    expect(localAgentsSnippet).toContain("symballist status");
    expect(localGuide).toContain("symballist watch --once");
    expect(localGuide).toContain('symballist lookup "<text>"');
    expect(localGuide).toContain("setup-type hybrid");
    expect(toolManifest).toContain("\"name\": \"symballist_lookup\"");
    expect(wrapperCmd).toContain('src\\cli.ts" %*');
    expect(localGuide).not.toContain("<PROJECT_ROOT>");
    expect(localGuide).not.toContain("<SYMBALLIST_ROOT>");
    expect(gitignore).toContain(".symballist/");
  });

  test("init preserves repo-local embeddings config instead of overwriting it", async () => {
    const root = await createFixtureRepo();
    await runInit(root);

    const config = await readConfig(root);
    expect(config).not.toBeNull();
    await writeConfig(root, {
      ...(config!),
      embeddings: {
        enabled: true,
        provider: "ollama",
        baseUrl: "http://127.0.0.1:11434",
        model: "nomic-embed-text",
        dimensions: 384
      }
    });

    await runInit(root);

    const preserved = await readConfig(root);
    expect(preserved?.setupType).toBe("hybrid");
    expect(preserved?.embeddings.enabled).toBeTrue();
    expect(preserved?.embeddings.baseUrl).toBe("http://127.0.0.1:11434");
    expect(preserved?.embeddings.model).toBe("nomic-embed-text");
    expect(preserved?.embeddings.dimensions).toBe(384);
  });

  test("init supports cli-only and tool-first setup modes", async () => {
    const cliRoot = await createFixtureRepo();
    await runInit(cliRoot, "cli");

    const cliConfig = await readConfig(cliRoot);
    const cliAgents = await readFile(join(cliRoot, "AGENTS.md"), "utf8");
    expect(cliConfig?.setupType).toBe("cli");
    expect(await Bun.file(join(cliRoot, ".symballist", "tools", "symballist-tools.json")).exists()).toBeFalse();
    expect(cliAgents).toContain("symballist status");
    expect(cliAgents).not.toContain(".symballist\\tools\\symballist-tools.json");

    const toolRoot = await createFixtureRepo();
    await runInit(toolRoot, "tool");

    const toolConfig = await readConfig(toolRoot);
    const toolAgents = await readFile(join(toolRoot, "AGENTS.md"), "utf8");
    const toolManifest = await readFile(join(toolRoot, ".symballist", "tools", "symballist-tools.json"), "utf8");
    expect(toolConfig?.setupType).toBe("tool");
    expect(await Bun.file(join(toolRoot, ".symballist", "tools", "symballist-tools.json")).exists()).toBeTrue();
    expect(toolAgents).toContain(".symballist\\tools\\symballist-tools.json");
    expect(toolManifest).toContain("\"name\": \"symballist_status\"");
  });

  test("shell guidance detects bash-like and Windows shells and returns matching entrypoints", () => {
    expect(detectShellFlavor({ SHELL: "/bin/bash" }, "win32")).toBe("posix");
    expect(detectShellFlavor({ PSModulePath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules" }, "win32")).toBe("powershell");
    expect(detectShellFlavor({ ComSpec: "C:\\Windows\\System32\\cmd.exe" }, "win32")).toBe("cmd");

    const posixGuidance = getShellGuidance("D:/Projects/co-ma", {
      env: { SHELL: "/bin/bash" },
      platform: "win32",
      cwd: "D:/Projects/co-ma"
    });
    expect(posixGuidance.detectedShell).toBe("posix");
    expect(posixGuidance.recommendedEntrypoint).toBe("./.symballist/bin/symballist");
    expect(posixGuidance.recommendedCommands.status).toBe("./.symballist/bin/symballist status");

    const cmdGuidance = getShellGuidance("D:/Projects/co-ma", {
      env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
      platform: "win32",
      cwd: "D:/Projects/co-ma"
    });
    expect(cmdGuidance.detectedShell).toBe("cmd");
    expect(cmdGuidance.recommendedEntrypoint).toBe(".\\.symballist\\bin\\symballist.cmd");
  });

  test("init creates or appends .symballist ignore rules without duplicating them", async () => {
    const root = await createFixtureRepo();
    await writeFile(join(root, ".gitignore"), "node_modules/\n", "utf8");

    await runInit(root);
    await runInit(root);

    const gitignore = await readFile(join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore.match(/^\.symballist\/$/gm)?.length ?? 0).toBe(1);

    const blankRoot = await mkdtemp(join(tmpdir(), "symballist-"));
    tempRoots.push(blankRoot);
    await runInit(blankRoot);
    const createdGitignore = await readFile(join(blankRoot, ".gitignore"), "utf8");
    expect(createdGitignore.trim()).toBe(".symballist/");
  });

  test("init warns when .symballist is already git-tracked and gitignore is newly updated", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await writeFile(join(root, ".gitignore"), "node_modules/\n", "utf8");

    await Bun.$`git init`.cwd(root).quiet();
    await Bun.$`git add .symballist`.cwd(root).quiet();

    const output = await captureConsoleLog(async () => {
      await runInit(root);
    });

    expect(output).toContain("git rm --cached -r .symballist");
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
    expect(greet?.retrievalTrustLevel).toBe("high");
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
      setupType: string | null;
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
      changeAwareness: {
        sinceIndex: {
          changedFiles: number;
          newFiles: number;
          deletedFiles: number;
          changedPaths: string[];
          newPaths: string[];
          deletedPaths: string[];
          truncated: boolean;
        };
        sinceGitHead: {
          available: boolean;
          changedFiles: number;
          newFiles: number;
          deletedFiles: number;
          changedPaths: string[];
          newPaths: string[];
          deletedPaths: string[];
          truncated: boolean;
        };
      };
      shellGuidance: {
        detectedShell: string;
        recommendedEntrypoint: string;
        alternativeEntrypoints: {
          cmd: string;
          powershell: string;
          posix: string;
        };
        recommendedCommands: {
          status: string;
          watchOnce: string;
          lookup: string;
        };
      };
    };

    expect(status.initialized).toBeTrue();
    expect(status.setupType).toBe("hybrid");
    expect(status.dbExists).toBeTrue();
    expect(status.supportedLanguages).toEqual(["html", "markdown", "python"]);
    expect(status.indexedFiles).toBe(7);
    expect(status.indexedSymbols).toBe(13);
    expect(status.fallbackSymbols).toBe(1);
    expect(status.indexedSchemaVersion).toBeGreaterThan(0);
    expect(status.indexFreshness.stale).toBeFalse();
    expect(status.changeAwareness.sinceIndex.changedFiles).toBe(0);
    expect(status.changeAwareness.sinceIndex.newFiles).toBe(0);
    expect(status.changeAwareness.sinceIndex.deletedFiles).toBe(0);
    expect(status.shellGuidance.recommendedEntrypoint.length).toBeGreaterThan(0);
    expect(status.shellGuidance.recommendedCommands.status).toContain("status");
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

  test("lookup bundles the best hit with full symbol context and alternatives", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const output = await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5);
    });
    const payload = JSON.parse(output) as {
      query: string;
      selectedResult: {
        name: string;
        retrievalTrustLevel: string;
      } | null;
      symbol: {
        name: string;
        body: string;
        trustLevel: string;
      } | null;
      bodyPresentation: {
        mode: string;
      } | null;
      relations: Array<{ kind: string }>;
      related: Array<{ symbol: { name: string } }>;
      alternatives: Array<{ name: string }>;
    };

    expect(payload.query).toBe("greet");
    expect(payload.selectedResult?.name).toBe("greet");
    expect(payload.selectedResult?.retrievalTrustLevel).toBe("high");
    expect(payload.symbol?.name).toBe("greet");
    expect(payload.symbol?.body).toContain('return f"Hello, {name}"');
    expect(payload.symbol?.trustLevel).toBe("high");
    expect(payload.bodyPresentation?.mode).toBe("full");
    expect(payload.relations.some((relation) => relation.kind === "contained_in")).toBeTrue();
    expect(payload.related.some((entry) => entry.symbol.name === "Greeter")).toBeTrue();
    expect(payload.alternatives.some((entry) => entry.name === "Greeter")).toBeTrue();
  });

  test("query, lookup, and show support compact output mode without repeated semantics blocks", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const queryPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "greet", 5, [], {}, { compact: true });
    })) as {
      resultSemantics?: unknown;
      retrieval: {
        mode: string;
      };
      results: Array<{ name: string }>;
    };

    const lookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5, [], {}, { compact: true });
    })) as {
      resultSemantics?: unknown;
      trustSemantics?: unknown;
      selectedResult: { name: string } | null;
      symbol: { name: string } | null;
    };

    const showPayload = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "greet", { compact: true });
    })) as {
      trustSemantics?: unknown;
      symbol: { name: string };
      bodyPresentation: { mode: string };
    };

    expect(queryPayload.resultSemantics).toBeUndefined();
    expect(queryPayload.retrieval.mode).toBe("lexical");
    expect(queryPayload.results[0]?.name).toBe("greet");

    expect(lookupPayload.resultSemantics).toBeUndefined();
    expect(lookupPayload.trustSemantics).toBeUndefined();
    expect(lookupPayload.selectedResult?.name).toBe("greet");
    expect(lookupPayload.symbol?.name).toBe("greet");

    expect(showPayload.trustSemantics).toBeUndefined();
    expect(showPayload.symbol.name).toBe("greet");
    expect(showPayload.bodyPresentation.mode).toBe("full");
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
        trustLevel: string;
        retrievalTrustLevel: string;
      };
      results: Array<{
        kind: string;
        distance: number;
        confidence: string;
        matchReason: string;
        extraction: string;
        trustLevel: string;
        retrievalTrustLevel: string;
      }>;
    };

    expect(queryPayload.kinds).toEqual(["import"]);
    expect(queryPayload.intent).toEqual({});
    expect(queryPayload.indexFreshness.stale).toBeFalse();
    expect(queryPayload.resultSemantics.distance).toBe("lower is better");
    expect(queryPayload.resultSemantics.confidenceOrder).toEqual(["exact", "strong", "related", "fallback"]);
    expect(queryPayload.resultSemantics.trustLevel).toContain("extraction trust");
    expect(queryPayload.resultSemantics.retrievalTrustLevel).toContain("retrieval trust");
    expect(queryPayload.results.length).toBeGreaterThan(0);
    expect(queryPayload.results.every((result) => result.kind === "import")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.distance === "number")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.confidence === "string")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.retrievalTrustLevel === "string")).toBeTrue();
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
    expect(normalizeRepoPath(results[0]?.path)).toBe("src/distiller.py");
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

    expect(normalizeRepoPath(memoryResults[0]?.path)).toBe("src/memory.py");
    expect(memoryResults[0]?.language).toBe("python");
    expect(memoryResults.some((result) => normalizeRepoPath(result.path) === "tests/test_memory.py")).toBeTrue();
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

    expect(normalizeRepoPath(results[0]?.path)).toBe("src/distiller.py");
    expect(results[0]?.name).toBe("DistillationEngine");
    expect(results[0]?.kind).toBe("class");
    expect(results[0]?.matchReason).toBe("path_concept");
    expect(results[0]?.confidence).toBe("strong");
    expect(results.some((result) => normalizeRepoPath(result.path) === "tests/test_distiller.py")).toBeTrue();
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
    expect(recoveredMemoryStore?.trustLevel).toBe("medium");
    expect(recoveredMemoryStore?.retrievalTrustLevel).toBe("high");
    expect(looseToken.some((result) => result.matchReason === "token_overlap")).toBeTrue();
  });

  test("query and show agree on extraction trust while query also exposes retrieval trust", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });

    const oversizedSource = [
      "class DistillationEngine:",
      "    pass",
      "",
      "# filler",
      "# filler\n".repeat(5000)
    ].join("\n");

    await writeFile(join(root, "src", "distiller.py"), oversizedSource, "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    const queryPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "DistillationEngine", 5);
    })) as {
      results: Array<{
        id: number;
        name: string;
        extraction: string;
        trustLevel: string;
        retrievalTrustLevel: string;
      }>;
    };

    const queryResult = queryPayload.results.find((result) => result.name === "DistillationEngine");
    expect(queryResult).toBeDefined();
    expect(queryResult?.extraction).toBe("recovered");
    expect(queryResult?.trustLevel).toBe("medium");
    expect(queryResult?.retrievalTrustLevel).toBe("high");

    const showPayload = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "DistillationEngine");
    })) as {
      trustSemantics: {
        trustLevel: string;
      };
      symbol: {
        id: number;
        name: string;
        extraction: string;
        trustLevel: string;
      };
    };

    expect(showPayload.trustSemantics.trustLevel).toContain("extraction trust only");
    expect(showPayload.symbol.id).toBe(queryResult?.id);
    expect(showPayload.symbol.name).toBe("DistillationEngine");
    expect(showPayload.symbol.extraction).toBe("recovered");
    expect(showPayload.symbol.trustLevel).toBe("medium");
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
      preferImplementation: true
    });
    db.close();

    expect(codeOnly.length).toBeGreaterThan(0);
    expect(codeOnly.every((result) => result.language !== "markdown")).toBeTrue();
    expect(docsOnly.length).toBeGreaterThan(0);
    expect(docsOnly.every((result) => result.language === "markdown")).toBeTrue();
    expect(excludeTests.every((result) => !normalizeRepoPath(result.path)?.startsWith("tests/"))).toBeTrue();
    expect(preferImplementation.every((result) => result.language !== "markdown")).toBeTrue();
    expect(normalizeRepoPath(preferImplementation[0]?.path)).toBe("src/memory_store.py");

    const payload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "memory store", 5, [], {
        preferImplementation: true
      });
    })) as {
      intent: {
        codeOnly?: boolean;
        docsOnly?: boolean;
        preferImplementation: boolean;
      };
      results: Array<{ path: string }>;
    };

    expect(payload.intent.preferImplementation).toBeTrue();
    expect(normalizeRepoPath(payload.results[0]?.path)).toBe("src/memory_store.py");
    expect(payload.results.every((result) => !result.path.endsWith(".md"))).toBeTrue();
  });

  test("docs-only prefers canonical docs over duplicated operational mirrors", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, ".codex", "skills", "memory"), { recursive: true });
    await writeFile(
      join(root, "docs", "memory-management.md"),
      "# Memory Management\n\nCanonical memory management architecture notes.\n",
      "utf8"
    );
    await writeFile(
      join(root, "README.md"),
      "# Project\n\n## Memory Management\n\nOverview of memory management.\n",
      "utf8"
    );
    await writeFile(
      join(root, "AGENTS.md"),
      "## Memory Management\n\nOperational memory management instructions for agents.\n",
      "utf8"
    );
    await writeFile(
      join(root, "CLAUDE.md"),
      "## Memory Management\n\nOperational memory management instructions for Claude.\n",
      "utf8"
    );
    await writeFile(
      join(root, ".codex", "skills", "memory", "SKILL.md"),
      "## Memory Management\n\nInternal mirrored instructions.\n",
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const docsOnly = searchSymbols(db, buildFtsQuery("memory management"), 5, {
      rawQuery: "memory management",
      docsOnly: true
    });
    db.close();

    expect(docsOnly.length).toBeGreaterThan(0);
    expect(docsOnly.every((result) => result.language === "markdown")).toBeTrue();
    expect(normalizeRepoPath(docsOnly[0]?.path)).toBe("docs/memory-management.md");
    expect(docsOnly.slice(0, 2).some((result) => result.path === "README.md")).toBeTrue();
    expect(docsOnly.slice(0, 2).every((result) => !["AGENTS.md", "CLAUDE.md"].includes(result.path))).toBeTrue();

    const payload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "memory management", 5, [], {
        docsOnly: true
      });
    })) as {
      intent: {
        docsOnly: boolean;
      };
      results: Array<{
        path: string;
        language: string;
      }>;
    };

    expect(payload.intent.docsOnly).toBeTrue();
    expect(normalizeRepoPath(payload.results[0]?.path)).toBe("docs/memory-management.md");
    expect(payload.results.every((result) => result.language === "markdown")).toBeTrue();
    expect(payload.results.slice(0, 2).every((result) => !["AGENTS.md", "CLAUDE.md"].includes(result.path))).toBeTrue();
  });

  test("weak low-signal queries suppress duplicate operational mirror docs", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "docs", "memory-management.md"),
      "# Memory Management\n\nProject memory handling and retention notes.\n",
      "utf8"
    );
    await writeFile(
      join(root, "AGENTS.md"),
      "## Memory Notes\n\nOperational mirror for memory handling guidance.\n",
      "utf8"
    );
    await writeFile(
      join(root, "CLAUDE.md"),
      "## Memory Notes\n\nOperational mirror for memory handling guidance.\n",
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, buildFtsQuery("memory ghost cleanup"), 5, {
      rawQuery: "memory ghost cleanup"
    });
    db.close();

    expect(results.length).toBeGreaterThan(0);
    expect(normalizeRepoPath(results[0]?.path)).toBe("docs/memory-management.md");
    expect(results.slice(0, 5).filter((result) => ["AGENTS.md", "CLAUDE.md"].includes(result.path)).length).toBeLessThanOrEqual(1);
  });

  test("prefer-implementation alone suppresses doc noise and visibly changes default ranking", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "ROADMAP.md"),
      "# Deferred\n\nGateway config api live reload notes.\n",
      "utf8"
    );
    await writeFile(
      join(root, "src", "config_api.py"),
      'async def apply_config(payload):\n    """gateway config api live reload"""\n    return payload\n',
      "utf8"
    );
    await writeFile(
      join(root, "src", "registry.py"),
      'def reload_config() -> str:\n    return "gateway config api live reload"\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const defaultResults = searchSymbols(db, buildFtsQuery("gateway config api live reload"), 5, {
      rawQuery: "gateway config api live reload"
    });
    const preferResults = searchSymbols(db, buildFtsQuery("gateway config api live reload"), 5, {
      rawQuery: "gateway config api live reload",
      preferImplementation: true
    });
    db.close();

    expect(defaultResults.some((result) => result.language === "markdown")).toBeTrue();
    expect(preferResults.every((result) => result.language !== "markdown")).toBeTrue();
    expect(normalizeRepoPath(preferResults[0]?.path)?.startsWith("src/")).toBeTrue();
  });

  test("graph-aware reranking promotes import-connected implementation neighborhoods", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "store.py"),
      'class MemoryStore:\n    """Store implementation."""\n    pass\n',
      "utf8"
    );
    await writeFile(
      join(root, "src", "bootstrap.py"),
      'from src.store import MemoryStore\n\n\ndef bootstrap_store() -> MemoryStore:\n    """bootstrap memory store flow"""\n    return MemoryStore()\n',
      "utf8"
    );
    await writeFile(
      join(root, "src", "notes.py"),
      'def bootstrap_notes() -> str:\n    """bootstrap notes helper"""\n    return "bootstrap notes"\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, buildFtsQuery("bootstrap memory store"), 5, {
      rawQuery: "bootstrap memory store"
    });
    db.close();

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(normalizeRepoPath(results[0]?.path)).toBe("src/bootstrap.py");
    expect(normalizeRepoPath(results[1]?.path)).toBe("src/store.py");
    expect(results[1]?.graphSignals).toContain("imported_by_candidate");
    expect(results.findIndex((result) => normalizeRepoPath(result.path) === "src/store.py")).toBeLessThan(results.findIndex((result) => normalizeRepoPath(result.path) === "src/notes.py"));
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
      changeAwareness: {
        sinceIndex: {
          changedFiles: number;
          newFiles: number;
          deletedFiles: number;
          changedPaths: string[];
          newPaths: string[];
          deletedPaths: string[];
        };
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
    expect(status.changeAwareness.sinceIndex.changedFiles).toBe(1);
    expect(status.changeAwareness.sinceIndex.changedPaths).toContain("helpers.py");
    expect(queryPayload.indexFreshness.stale).toBeTrue();
    expect(queryPayload.indexFreshness.changedFiles).toBe(1);
  });

  test("status reports lightweight file-level changes since git HEAD for indexed source files", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await Bun.$`git init`.cwd(root).quiet();
    await Bun.$`git add .`.cwd(root).quiet();
    await Bun.$`git -c user.name=Symballist -c user.email=symballist@example.com commit -m "initial snapshot"`.cwd(root).quiet();
    await runIndex(root, { progress: false });

    await writeFile(join(root, "helpers.py"), 'def slugify(value: str) -> str:\n    return value.lower()\n', "utf8");
    await writeFile(join(root, "new_notes.md"), "# Notes\n\nFresh markdown notes.\n", "utf8");

    const output = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(output) as {
      changeAwareness: {
        sinceGitHead: {
          available: boolean;
          changedFiles: number;
          newFiles: number;
          deletedFiles: number;
          changedPaths: string[];
          newPaths: string[];
          deletedPaths: string[];
        };
      };
    };

    expect(status.changeAwareness.sinceGitHead.available).toBeTrue();
    expect(status.changeAwareness.sinceGitHead.changedFiles).toBe(1);
    expect(status.changeAwareness.sinceGitHead.changedPaths).toContain("helpers.py");
    expect(status.changeAwareness.sinceGitHead.newFiles).toBe(1);
    expect(status.changeAwareness.sinceGitHead.newPaths).toContain("new_notes.md");
    expect(status.changeAwareness.sinceGitHead.deletedFiles).toBe(0);
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
    expect(agentConfig?.trustLevel).toBe("medium");
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

  test("cli args accept init setup-type selection", () => {
    const parsed = parseCliArgs(["init", "--root", "D:/Projects/co-ma", "--setup-type", "tool"]);
    expect(parsed.command).toBe("init");
    expect(parsed.root).toBe("D:/Projects/co-ma");
    expect(parsed.setupType).toBe("tool");
    expect(parsed.error).toBeNull();

    const invalid = parseCliArgs(["init", "--setup-type", "weird"]);
    expect(invalid.error).toContain("cli, tool, or hybrid");
  });

  test("watch can perform an initial index pass and incremental refresh in one-shot mode", async () => {
    const root = await createFixtureRepo();
    await runInit(root);

    const initialWatchOutput = JSON.parse(await captureConsoleLog(async () => {
      await runWatch(root, { once: true });
    })) as {
      event: string;
      reason: string;
      stats: {
        indexedFiles: number;
        skippedFiles: number;
      } | null;
      indexFreshnessAfter: {
        stale: boolean;
      };
    };

    expect(initialWatchOutput.event).toBe("indexed");
    expect(initialWatchOutput.reason).toBe("initial_index");
    expect(initialWatchOutput.stats?.indexedFiles).toBe(7);
    expect(initialWatchOutput.indexFreshnessAfter.stale).toBeFalse();

    await writeFile(join(root, "helpers.py"), 'def slugify(value: str) -> str:\n    return value.upper()\n', "utf8");

    const refreshWatchOutput = JSON.parse(await captureConsoleLog(async () => {
      await runWatch(root, { once: true });
    })) as {
      event: string;
      reason: string;
      stats: {
        indexedFiles: number;
        skippedFiles: number;
      } | null;
      indexFreshnessBefore: {
        stale: boolean;
        changedFiles: number;
      };
      indexFreshnessAfter: {
        stale: boolean;
      };
    };

    expect(refreshWatchOutput.event).toBe("indexed");
    expect(refreshWatchOutput.reason).toBe("stale_index");
    expect(refreshWatchOutput.indexFreshnessBefore.stale).toBeTrue();
    expect(refreshWatchOutput.indexFreshnessBefore.changedFiles).toBe(1);
    expect(refreshWatchOutput.stats?.indexedFiles).toBe(1);
    expect(refreshWatchOutput.stats?.skippedFiles).toBe(6);
    expect(refreshWatchOutput.indexFreshnessAfter.stale).toBeFalse();

    const db = await openDatabase(root);
    const refreshed = searchSymbols(db, "slugify", 5);
    db.close();
    expect(refreshed.some((result) => result.name === "slugify")).toBeTrue();
  });

  test("hybrid retrieval can supplement lexical search with optional Ollama embeddings", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "meaning_store.py"),
      'class MeaningStore:\n    """Canonical semantic store implementation."""\n    pass\n',
      "utf8"
    );
    await runInit(root);

    const config = await readConfig(root);
    await writeConfig(root, {
      ...(config!),
      embeddings: {
        enabled: true,
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "all-minilm",
        dimensions: null
      }
    });

    const vectorFor = (text: string): number[] => {
      const normalized = text.toLowerCase();
      if (normalized.includes("semantic memory") || normalized.includes("meaningstore") || normalized.includes("meaning_store.py")) {
        return [1, 0, 0];
      }
      return [0, 1, 0];
    };

    await withMockFetch(async (_url, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as { input?: string | string[]; model?: string };
      const input = Array.isArray(payload.input) ? payload.input : [payload.input ?? ""];
      return Response.json({
        model: payload.model ?? "all-minilm",
        embeddings: input.map((item) => vectorFor(String(item)))
      });
    }, async () => {
      const stats = await runIndex(root, { progress: false });
      expect(stats.embeddedSymbols).toBeGreaterThan(0);

      const output = JSON.parse(await captureConsoleLog(async () => {
        await runQuery(root, "semantic memory", 5);
      })) as {
        retrieval: {
          mode: string;
          embeddings: {
            available: boolean;
            matchedEmbeddings: number;
            queryEmbedded: boolean;
            queryError: string | null;
          };
          hybrid: {
            lexicalCandidates: number;
            conceptCandidates: number;
            semanticCandidatesRetrieved: number;
            semanticCandidatesMerged: number;
            semanticCandidatesRetained: number;
            topResultHasSemanticSignal: boolean;
            topSemanticCandidate: {
              name: string;
              semanticSimilarity: number;
              retained: boolean;
              resultRank: number | null;
            } | null;
          } | null;
        };
        results: Array<{
          name: string;
          matchReason: string;
          semanticSimilarity: number | null;
          retrievalChannels: string[];
          hybridContribution: string;
        }>;
      };

      expect(output.retrieval.mode).toBe("hybrid");
      expect(output.retrieval.embeddings.available).toBeTrue();
      expect(output.retrieval.embeddings.matchedEmbeddings).toBeGreaterThan(0);
      expect(output.retrieval.embeddings.queryEmbedded).toBeTrue();
      expect(output.retrieval.embeddings.queryError).toBeNull();
      expect(output.retrieval.hybrid?.semanticCandidatesRetrieved).toBeGreaterThan(0);
      expect(output.retrieval.hybrid?.semanticCandidatesMerged).toBeGreaterThan(0);
      expect(output.retrieval.hybrid?.semanticCandidatesRetained).toBeGreaterThan(0);
      expect(output.retrieval.hybrid?.topResultHasSemanticSignal).toBeTrue();
      expect(output.retrieval.hybrid?.topSemanticCandidate?.name).toBe("MeaningStore");
      expect(output.retrieval.hybrid?.topSemanticCandidate?.retained).toBeTrue();
      expect(output.retrieval.hybrid?.topSemanticCandidate?.resultRank).toBe(1);
      expect(output.results[0]?.name).toBe("MeaningStore");
      expect(output.results[0]?.matchReason).toBe("semantic_similarity");
      expect(output.results[0]?.semanticSimilarity).toBeGreaterThan(0.8);
      expect(output.results[0]?.retrievalChannels).toContain("semantic");
      expect(["semantic_only", "semantic_assisted"]).toContain(output.results[0]?.hybridContribution ?? "");

      const exactOutput = JSON.parse(await captureConsoleLog(async () => {
        await runQuery(root, "MeaningStore", 5);
      })) as {
        results: Array<{
          name: string;
          matchReason: string;
          semanticSimilarity: number | null;
          retrievalChannels: string[];
          hybridContribution: string;
        }>;
      };

      expect(exactOutput.results[0]?.name).toBe("MeaningStore");
      expect(exactOutput.results[0]?.matchReason).toBe("exact_symbol_name");
      expect(exactOutput.results[0]?.semanticSimilarity).toBeGreaterThan(0.8);
      expect(exactOutput.results[0]?.retrievalChannels).toContain("semantic");
      expect(exactOutput.results[0]?.hybridContribution).toBe("semantic_assisted");
    });
  });

  test("hybrid fusion can promote semantic implementation hits over weak lexical doc noise", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "docs", "persistence.md"),
      "# Persistence\n\nSQLite backed persisted memories and migration notes.\n",
      "utf8"
    );
    await writeFile(
      join(root, "src", "memory_store.py"),
      'class MemoryStore:\n    """Canonical persisted memory store implementation."""\n    pass\n',
      "utf8"
    );

    await runInit(root);
    const config = await readConfig(root);
    await writeConfig(root, {
      ...(config!),
      embeddings: {
        enabled: true,
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "all-minilm",
        dimensions: null
      }
    });

    const vectorFor = (text: string): number[] => {
      const normalized = text.toLowerCase();
      if (normalized.includes("sqlite backed persisted memories")
        || normalized.includes("canonical persisted memory store")
        || normalized.includes("memorystore")) {
        return [1, 0, 0];
      }
      return [0, 1, 0];
    };

    await withMockFetch(async (_url, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as { input?: string | string[]; model?: string };
      const input = Array.isArray(payload.input) ? payload.input : [payload.input ?? ""];
      return Response.json({
        model: payload.model ?? "all-minilm",
        embeddings: input.map((item) => vectorFor(String(item)))
      });
    }, async () => {
      const stats = await runIndex(root, { progress: false });
      expect(stats.embeddedSymbols).toBeGreaterThan(0);

      const output = JSON.parse(await captureConsoleLog(async () => {
        await runQuery(root, "sqlite backed persisted memories", 5);
      })) as {
        retrieval: {
          mode: string;
          hybrid: {
            semanticCandidatesRetrieved: number;
            semanticCandidatesRetained: number;
            topResultHasSemanticSignal: boolean;
          } | null;
        };
        results: Array<{
          name: string;
          path: string;
          retrievalChannels: string[];
          hybridContribution: string;
          semanticSimilarity: number | null;
        }>;
      };

      expect(output.retrieval.mode).toBe("hybrid");
      expect(output.retrieval.hybrid?.semanticCandidatesRetrieved).toBeGreaterThan(0);
      expect(output.retrieval.hybrid?.semanticCandidatesRetained).toBeGreaterThan(0);
      expect(output.retrieval.hybrid?.topResultHasSemanticSignal).toBeTrue();
      expect(output.results[0]?.name).toBe("MemoryStore");
      expect(normalizeRepoPath(output.results[0]?.path)).toBe("src/memory_store.py");
      expect(output.results[0]?.retrievalChannels).toContain("semantic");
      expect(["semantic_only", "semantic_assisted"]).toContain(output.results[0]?.hybridContribution ?? "");
      expect(output.results[0]?.semanticSimilarity).toBeGreaterThan(0.8);
    });
  });

  test("embedding payloads are truncated for very large symbol bodies", () => {
    const text = buildEmbeddingText({
      path: "src/memory_store.py",
      language: "python",
      kind: "class",
      name: "MemoryStore",
      signature: "class MemoryStore",
      doc: "Large store",
      body: Array.from({ length: 5000 }, (_, index) => `line ${index} ${"x".repeat(40)}`).join("\n")
    });

    expect(text.length).toBeLessThanOrEqual(6000);
    expect(text.split(/\r?\n/).length).toBeLessThanOrEqual(120);
    expect(text).toContain("MemoryStore");
  });

  test("index backfills embeddings for unchanged files after embeddings are enabled", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const config = await readConfig(root);
    await writeConfig(root, {
      ...(config!),
      embeddings: {
        enabled: true,
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "nomic-embed-text:latest",
        dimensions: null
      }
    });

    await withMockFetch(async (_url, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as { input?: string | string[]; model?: string };
      const input = Array.isArray(payload.input) ? payload.input : [payload.input ?? ""];
      return Response.json({
        model: payload.model ?? "nomic-embed-text:latest",
        embeddings: input.map(() => [1, 0, 0])
      });
    }, async () => {
      const stats = await runIndex(root, { progress: false });
      expect(stats.indexedFiles).toBe(0);
      expect(stats.skippedFiles).toBe(7);
      expect(stats.embeddedSymbols).toBeGreaterThan(0);

      const status = JSON.parse(await captureConsoleLog(async () => {
        await runStatus(root);
      })) as {
        embeddings: {
          enabled: boolean;
          available: boolean;
          matchedEmbeddings: number;
        };
      };

      expect(status.embeddings.enabled).toBeTrue();
      expect(status.embeddings.available).toBeTrue();
      expect(status.embeddings.matchedEmbeddings).toBeGreaterThan(0);
    });
  });

  test("cli args support show by symbol name, query intent flags, and default to tighter query result counts", () => {
    const queryParsed = parseCliArgs(["query", "greet"]);
    expect(queryParsed.limit).toBe(5);
    expect(queryParsed.compactOutput).toBeFalse();
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

    const lookupParsed = parseCliArgs(["lookup", "greet", "--top", "3", "--code-only", "--full"]);
    expect(lookupParsed.command).toBe("lookup");
    expect(lookupParsed.limit).toBe(3);
    expect(lookupParsed.codeOnly).toBeTrue();
    expect(lookupParsed.showFull).toBeTrue();

    const compactLookupParsed = parseCliArgs(["lookup", "greet", "--compact"]);
    expect(compactLookupParsed.compactOutput).toBeTrue();

    const watchParsed = parseCliArgs(["watch", "--root", "D:/Projects/co-ma", "--interval-ms", "1500", "--once"]);
    expect(watchParsed.command).toBe("watch");
    expect(watchParsed.root).toBe("D:/Projects/co-ma");
    expect(watchParsed.watchIntervalMs).toBe(1500);
    expect(watchParsed.watchOnce).toBeTrue();

    const showParsed = parseCliArgs(["show", "--name", "greet", "--root", "D:/Projects/co-ma"]);
    expect(showParsed.command).toBe("show");
    expect(showParsed.showName).toBe("greet");
    expect(showParsed.showFull).toBeFalse();
    expect(showParsed.root).toBe("D:/Projects/co-ma");
    expect(showParsed.positionals).toEqual([]);
    expect(showParsed.error).toBeNull();

    const showFullParsed = parseCliArgs(["show", "--name", "greet", "--full"]);
    expect(showFullParsed.showFull).toBeTrue();

    const compactShowParsed = parseCliArgs(["show", "--name", "greet", "--compact"]);
    expect(compactShowParsed.compactOutput).toBeTrue();
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

  test("lookup help is handled as CLI help instead of lookup text", async () => {
    const parsed = parseCliArgs(["lookup", "--help"]);
    expect(parsed.command).toBe("lookup");
    expect(parsed.helpRequested).toBeTrue();
    expect(parsed.positionals).toEqual([]);
    expect(parsed.error).toBeNull();

    const output = await captureConsoleLog(async () => {
      await runCli(["lookup", "--help"]);
    });
    expect(output).toContain('symballist lookup "<text>"');
  });

  test("query accepts --top as a limit alias without reaching FTS with raw flag text", async () => {
    const parsed = parseCliArgs(["query", "--top", "5", "greet"]);
    expect(parsed.command).toBe("query");
    expect(parsed.limit).toBe(5);
    expect(parsed.positionals).toEqual(["greet"]);
    expect(parsed.error).toBeNull();
  });

  test("punctuation-heavy literal queries do not crash and can still find matching indexed content", async () => {
    const root = await createFixtureRepo();
    await writeFile(
      join(root, "probe.md"),
      "# Probe\n\nMarker: SYMBALLIST-OMEGA-ALPHA-7291\n",
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const payload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "SYMBALLIST-OMEGA-ALPHA-7291", 5);
    })) as {
      query: string;
      results: Array<{
        path: string;
        snippet: string;
      }>;
    };

    expect(payload.query).toBe("SYMBALLIST-OMEGA-ALPHA-7291");
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0]?.path).toBe("probe.md");
    expect(payload.results[0]?.snippet).toContain("SYMBALLIST-OMEGA-ALPHA-7291");
  });
});
