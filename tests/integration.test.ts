import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runIndex } from "../src/commands/index.ts";
import { runGraph } from "../src/commands/graph.ts";
import { runInit } from "../src/commands/init.ts";
import { runLookup } from "../src/commands/lookup.ts";
import { runQuery } from "../src/commands/query.ts";
import { runReport } from "../src/commands/report.ts";
import { summarizeRetrievalQuality } from "../src/commands/resultQuality.ts";
import { runShow } from "../src/commands/show.ts";
import { runStatus } from "../src/commands/status.ts";
import { runWatch } from "../src/commands/watch.ts";
import { CURRENT_INDEX_FORMAT_VERSION, buildFtsQuery, getBestSymbolByName, getRelatedSymbolsForSymbol, getRelationsForSymbol, getSymbolById, getWatchOwnershipStatus, openDatabase, searchSymbols, updateWatchOwnership } from "../src/db.ts";
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
    expect(await Bun.file(join(root, ".symballist", "scope.txt")).exists()).toBeTrue();
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
    expect(localGuide).toContain("one-shot best-match flow");
    expect(localGuide).toContain("impactTracking.enabled");
    expect(localGuide).toContain("setup-type hybrid");
    expect(toolManifest).toContain("\"name\": \"symballist_lookup\"");
    expect(toolManifest).toContain("\"name\": \"symballist_report\"");
    expect(toolManifest).toContain("Best-match flow: resolve one selected hit with graph diagnostics, symbol context");
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

  test("init can auto-detect enabled languages and scaffold matching profile folders", async () => {
    const root = await createFixtureRepo();

    await runInit(root, undefined, { autoDetectLanguages: true });

    const config = await readConfig(root);
    expect(config?.languages).toEqual(["python", "html", "markdown"]);
    expect(await Bun.file(join(root, ".symballist", "profiles", "python", "agents.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "profiles", "html", "instructions.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "profiles", "markdown", "scope.txt")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "profiles", "ruby", "agents.md")).exists()).toBeFalse();

    const localAgentsSnippet = await readFile(join(root, ".symballist", "instructions", "AGENTS.symballist.md"), "utf8");
    expect(localAgentsSnippet).toContain("Python, HTML, Markdown");
    expect(localAgentsSnippet).toContain("Python support covers parsed top-level classes and functions well");
    expect(localAgentsSnippet).toContain("HTML support is structural and lexical");
    expect(localAgentsSnippet).not.toContain("Ruby graph edges are still conservative");

    const seededPythonProfile = await readFile(join(root, ".symballist", "profiles", "python", "agents.md"), "utf8");
    expect(seededPythonProfile).toContain("Python support covers parsed top-level classes and functions well");
  });

  test("init can record an explicit enabled-language list", async () => {
    const root = await createFixtureRepo();

    await runInit(root, "hybrid", { languages: ["ruby", "typescript"] });

    const config = await readConfig(root);
    expect(config?.languages).toEqual(["ruby", "typescript"]);
    expect(await Bun.file(join(root, ".symballist", "profiles", "ruby", "agents.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "profiles", "typescript", "agents.md")).exists()).toBeTrue();
    expect(await Bun.file(join(root, ".symballist", "profiles", "python", "agents.md")).exists()).toBeFalse();

    const localAgentsSnippet = await readFile(join(root, ".symballist", "instructions", "AGENTS.symballist.md"), "utf8");
    expect(localAgentsSnippet).toContain("Ruby, TypeScript");
    expect(localAgentsSnippet).toContain("Ruby graph edges are still conservative");
    expect(localAgentsSnippet).toContain("TypeScript retrieval includes interface, enum, alias, class, and method symbols");

    const seededTypeScriptProfile = await readFile(join(root, ".symballist", "profiles", "typescript", "scope.txt"), "utf8");
    expect(seededTypeScriptProfile).toContain("node_modules/");
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
    const scopeFile = await readFile(join(blankRoot, ".symballist", "scope.txt"), "utf8");
    expect(scopeFile).toContain("Repo-scoped ignore and scope rules");
  });

  test("repo-scoped scope rules exclude matching paths from indexing and status surfaces", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "submods", "vendor-lib"), { recursive: true });
    await writeFile(join(root, "submods", "vendor-lib", "noise.rb"), "class Noise\nend\n", "utf8");
    await runInit(root);
    await writeFile(join(root, ".symballist", "scope.txt"), "submods/\n", "utf8");

    const files = await listSourceFiles(root);
    expect(files.some((file) => normalizeRepoPath(file.relativePath) === "submods/vendor-lib/noise.rb")).toBeFalse();

    const stats = await runIndex(root, { progress: false, emitStats: false });
    expect(stats.discoveredFiles).toBe(7);

    const output = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(output) as {
      scopeControl: {
        exists: boolean;
        ruleCount: number;
        rules: string[];
      };
      indexedFiles: number;
      indexFreshness: {
        scopeChanged: boolean;
      };
    };

    expect(status.scopeControl.exists).toBeTrue();
    expect(status.scopeControl.ruleCount).toBe(1);
    expect(status.scopeControl.rules).toEqual(["submods/"]);
    expect(status.indexedFiles).toBe(7);
    expect(status.indexFreshness.scopeChanged).toBeFalse();
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

  test("indexes JavaScript and TypeScript symbols and reports those languages in status", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "web.js"),
      [
        "export class Greeter {",
        "  greet(name) {",
        "    return name;",
        "  }",
        "}",
        "",
        "export function slugify(value) {",
        "  return value.toLowerCase();",
        "}",
        "",
        "export const buildWidget = (label) => label;"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "src", "agent.ts"),
      [
        "export interface AgentConfig {",
        "  name: string;",
        "}",
        "",
        "export type AgentId = string;",
        "",
        "export enum Mode {",
        "  Fast,",
        "  Safe",
        "}",
        "",
        "export const createAgent = (name: string): AgentConfig => ({ name });"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    const stats = await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greeterResults = searchSymbols(db, buildFtsQuery("Greeter"), 5, { rawQuery: "Greeter" });
    const agentConfigResults = searchSymbols(db, buildFtsQuery("AgentConfig"), 5, { rawQuery: "AgentConfig" });
    const createAgentResults = searchSymbols(db, buildFtsQuery("createAgent"), 5, { rawQuery: "createAgent" });
    const greetResults = searchSymbols(db, buildFtsQuery("greet"), 5, { rawQuery: "greet" });
    db.close();

    expect(stats.discoveredFiles).toBe(9);
    expect(greeterResults[0]?.language).toBe("javascript");
    expect(normalizeRepoPath(greeterResults[0]?.path)).toBe("src/web.js");
    expect(greeterResults[0]?.kind).toBe("class");
    expect(agentConfigResults[0]?.language).toBe("typescript");
    expect(normalizeRepoPath(agentConfigResults[0]?.path)).toBe("src/agent.ts");
    expect(agentConfigResults[0]?.kind).toBe("interface");
    expect(createAgentResults[0]?.kind).toBe("function");
    expect(greetResults.some((result) => result.kind === "method")).toBeTrue();

    const status = JSON.parse(await captureConsoleLog(async () => {
      await runStatus(root);
    })) as {
      supportedLanguages: string[];
    };

    expect(status.supportedLanguages).toContain("javascript");
    expect(status.supportedLanguages).toContain("typescript");
  });

  test("indexes plain non-exported JavaScript class declarations", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "clustering_card.js"),
      [
        "class ClusteringCard {",
        "  render() {",
        '    return \"card\";',
        "  }",
        "}",
        "",
        "export default ClusteringCard;"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const classResults = searchSymbols(db, buildFtsQuery("ClusteringCard"), 5, { rawQuery: "ClusteringCard" });
    const methodResults = searchSymbols(db, buildFtsQuery("render"), 5, { rawQuery: "render" });
    db.close();

    expect(classResults.some((result) => result.language === "javascript" && result.kind === "class" && normalizeRepoPath(result.path) === "src/clustering_card.js")).toBeTrue();
    expect(methodResults.some((result) => result.language === "javascript" && result.kind === "method" && normalizeRepoPath(result.path) === "src/clustering_card.js")).toBeTrue();
  });

  test("typed queries can match TypeScript parameter types and Python return annotations", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "agent.ts"),
      [
        "export interface WorkspaceConfig {",
        "  id: string;",
        "}",
        "",
        "export function startWorkspace(config: WorkspaceConfig): boolean {",
        "  return Boolean(config.id);",
        "}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "src", "grades.py"),
      [
        "from typing import List",
        "",
        "def list_grades() -> List[int]:",
        "    return [1, 2, 3]"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const tsResults = searchSymbols(db, buildFtsQuery("what accepts WorkspaceConfig"), 5, {
      rawQuery: "what accepts WorkspaceConfig"
    });
    const pyResults = searchSymbols(db, buildFtsQuery("what returns list int"), 5, {
      rawQuery: "what returns list int"
    });
    db.close();

    expect(normalizeRepoPath(tsResults[0]?.path)).toBe("src/agent.ts");
    expect(tsResults[0]?.name).toBe("startWorkspace");
    expect(tsResults[0]?.matchReason).toBe("signature_text");
    expect(tsResults[0]?.confidence).toBe("strong");

    expect(normalizeRepoPath(pyResults[0]?.path)).toBe("src/grades.py");
    expect(pyResults[0]?.name).toBe("list_grades");
    expect(pyResults[0]?.signature).toContain("-> List[int]");
    expect(pyResults[0]?.matchReason).toBe("signature_text");
    expect(pyResults[0]?.confidence).toBe("strong");
  });

  test("indexes Ruby symbols and lightweight require or usage relations", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "canvas"), { recursive: true });
    await writeFile(
      join(root, "canvas", "helpers.rb"),
      [
        "module Helpers",
        "  def self.normalize(user)",
        "    user.to_s.strip",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "canvas", "enrollment_service.rb"),
      [
        "require_relative \"./helpers\"",
        "",
        "module Canvas",
        "  class EnrollmentService",
        "    STATUS = \"active\"",
        "",
        "    def call(user)",
        "      Helpers.normalize(user)",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const classResults = searchSymbols(db, buildFtsQuery("EnrollmentService"), 5, { rawQuery: "EnrollmentService" });
    const constantResults = searchSymbols(db, buildFtsQuery("STATUS"), 5, { rawQuery: "STATUS" });
    const methodResults = searchSymbols(db, buildFtsQuery("call"), 5, { rawQuery: "call" });
    const shown = getBestSymbolByName(db, "call");
    const relationsFromDb = shown ? getRelationsForSymbol(db, shown) : [];
    db.close();

    expect(classResults[0]?.language).toBe("ruby");
    expect(normalizeRepoPath(classResults[0]?.path)).toBe("canvas/enrollment_service.rb");
    expect(classResults[0]?.kind).toBe("class");
    expect(classResults[0]?.signature).toContain("Canvas::EnrollmentService");
    expect(constantResults.some((result) => result.language === "ruby" && result.kind === "constant")).toBeTrue();
    expect(methodResults.some((result) => result.language === "ruby" && result.kind === "method")).toBeTrue();
    expect(relationsFromDb.some((relation) => relation.kind === "uses" && relation.targetLabel === "./helpers.normalize" && normalizeRepoPath(relation.targetPath) === "canvas/helpers.rb")).toBeTrue();

    const status = JSON.parse(await captureConsoleLog(async () => {
      await runStatus(root);
    })) as {
      supportedLanguages: string[];
    };

    expect(status.supportedLanguages).toContain("ruby");
  });

  test("lookup, show, and graph resolve fully-qualified Ruby names", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "services", "scoring"), { recursive: true });
    await writeFile(
      join(root, "app", "services", "scoring", "submit_parts.rb"),
      [
        "module Scoring",
        "  class SubmitParts",
        "    def call(part)",
        "      part.to_s",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const lookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "Scoring::SubmitParts", 5);
    })) as {
      selectedResult?: {
        name: string;
        path: string;
      };
    };

    const showPayload = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "Scoring::SubmitParts");
    })) as {
      symbol?: {
        name: string;
        path: string;
      };
    };

    const graphPayload = JSON.parse(await captureConsoleLog(async () => {
      await runGraph(root, "", "Scoring::SubmitParts");
    })) as {
      symbol?: {
        name: string;
        path: string;
      };
    };

    expect(lookupPayload.selectedResult?.name).toBe("SubmitParts");
    expect(normalizeRepoPath(lookupPayload.selectedResult?.path)).toBe("app/services/scoring/submit_parts.rb");
    expect(showPayload.symbol?.name).toBe("SubmitParts");
    expect(normalizeRepoPath(showPayload.symbol?.path)).toBe("app/services/scoring/submit_parts.rb");
    expect(graphPayload.symbol?.name).toBe("SubmitParts");
    expect(normalizeRepoPath(graphPayload.symbol?.path)).toBe("app/services/scoring/submit_parts.rb");
  });

  test("lookup can be constrained to a matching path fragment", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "services"), { recursive: true });
    await mkdir(join(root, "app", "models"), { recursive: true });
    await writeFile(
      join(root, "app", "services", "student.rb"),
      [
        "class Student",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "app", "models", "student.rb"),
      [
        "class Student",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const serviceLookup = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "Student", 5, [], { includePaths: ["app/services/student.rb"] });
    })) as {
      selectedResult?: { path: string };
      alternatives?: Array<{ path: string }>;
    };
    const missingLookup = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "Student", 5, [], { includePaths: ["does/not/exist.rb"] });
    })) as {
      selectedResult?: { path: string } | null;
      alternatives?: Array<{ path: string }>;
    };

    expect(normalizeRepoPath(serviceLookup.selectedResult?.path)).toBe("app/services/student.rb");
    expect(serviceLookup.alternatives?.length ?? 0).toBe(0);
    expect(missingLookup.selectedResult ?? null).toBeNull();
    expect(missingLookup.alternatives ?? []).toEqual([]);
  });

  test("lookup, show, and graph prefer deep fully-qualified Ruby names over duplicate short-name symbols", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "models"), { recursive: true });
    await mkdir(join(root, "app", "services", "sis", "v2", "services", "writing"), { recursive: true });
    await writeFile(
      join(root, "app", "models", "student.rb"),
      [
        "class Student",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "app", "services", "sis", "v2", "services", "writing", "student.rb"),
      [
        "module Sis",
        "  module V2",
        "    module Services",
        "      module Writing",
        "        class Student",
        "        end",
        "      end",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const qualifiedName = "Sis::V2::Services::Writing::Student";

    const lookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, qualifiedName, 5);
    })) as {
      selectedResult?: {
        name: string;
        path: string;
      };
    };

    const showPayload = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", qualifiedName);
    })) as {
      symbol?: {
        name: string;
        path: string;
      };
    };

    const graphPayload = JSON.parse(await captureConsoleLog(async () => {
      await runGraph(root, "", qualifiedName);
    })) as {
      symbol?: {
        name: string;
        path: string;
      };
    };

    expect(lookupPayload.selectedResult?.name).toBe("Student");
    expect(normalizeRepoPath(lookupPayload.selectedResult?.path)).toBe("app/services/sis/v2/services/writing/student.rb");
    expect(showPayload.symbol?.name).toBe("Student");
    expect(normalizeRepoPath(showPayload.symbol?.path)).toBe("app/services/sis/v2/services/writing/student.rb");
    expect(graphPayload.symbol?.name).toBe("Student");
    expect(normalizeRepoPath(graphPayload.symbol?.path)).toBe("app/services/sis/v2/services/writing/student.rb");
  });

  test("namespace-qualified Ruby lookup ranks the intended module above unrelated short-name matches", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "services", "kids"), { recursive: true });
    await mkdir(join(root, "app", "services"), { recursive: true });
    await writeFile(
      join(root, "app", "services", "kids", "merge.rb"),
      [
        "module Kids",
        "  module Merge",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "app", "services", "kids_import.rb"),
      [
        "class KidsImport",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const lookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "Kids::Merge", 5);
    })) as {
      selectedResult?: { name: string; path: string };
      alternatives?: Array<{ name: string; path: string }>;
    };

    expect(lookupPayload.selectedResult?.name).toBe("Merge");
    expect(normalizeRepoPath(lookupPayload.selectedResult?.path)).toBe("app/services/kids/merge.rb");
    expect(lookupPayload.alternatives?.some((entry) =>
      entry.name === "KidsImport"
      && normalizeRepoPath(entry.path) === "app/services/kids_import.rb"
    )).toBeTrue();
  });

  test("namespace-qualified Ruby class lookup prefers the class over nested methods on the same namespace", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "lib", "sis", "v2", "services", "writing"), { recursive: true });
    await writeFile(
      join(root, "app", "lib", "sis", "v2", "services", "writing", "student.rb"),
      [
        "module Sis",
        "  module V2",
        "    module Services",
        "      module Writing",
        "        class Student",
        "          def profile",
        "            true",
        "          end",
        "        end",
        "      end",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const lookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "Sis::V2::Services::Writing::Student", 5);
    })) as {
      selectedResult?: { name: string; path: string; kind: string };
    };

    expect(lookupPayload.selectedResult?.name).toBe("Student");
    expect(lookupPayload.selectedResult?.kind).toBe("class");
    expect(normalizeRepoPath(lookupPayload.selectedResult?.path)).toBe("app/lib/sis/v2/services/writing/student.rb");
  });

  test("ruby infers cross-file uses relations from Rails-style constant references", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "models"), { recursive: true });
    await mkdir(join(root, "app", "services", "scoring"), { recursive: true });
    await writeFile(
      join(root, "app", "models", "student.rb"),
      [
        "class Student",
        "  def self.active",
        "    true",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "app", "services", "scoring", "gradebook.rb"),
      [
        "module Scoring",
        "  class Gradebook",
        "    def self.persist(student)",
        "      student",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "app", "services", "scoring", "submit_parts.rb"),
      [
        "module Scoring",
        "  class SubmitParts",
        "    def call",
        "      Gradebook.persist(Student.new)",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const showPayload = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "Scoring::SubmitParts");
    })) as {
      relations?: Array<{ kind: string; targetLabel: string; targetPath: string | null }>;
      related?: Array<{ relation: { kind: string }; symbol: { name: string; path: string } }>;
    };

    const graphPayload = JSON.parse(await captureConsoleLog(async () => {
      await runGraph(root, "", "Scoring::SubmitParts");
    })) as {
      graph?: {
        uses: Array<{ symbol: { name: string; path: string } }>;
      };
    };

    expect(showPayload.relations?.some((relation) =>
      relation.kind === "uses"
      && relation.targetLabel === "Scoring::Gradebook"
      && normalizeRepoPath(relation.targetPath) === "app/services/scoring/gradebook.rb"
    )).toBeTrue();
    expect(showPayload.relations?.some((relation) =>
      relation.kind === "uses"
      && relation.targetLabel === "Student"
      && normalizeRepoPath(relation.targetPath) === "app/models/student.rb"
    )).toBeTrue();
    expect(showPayload.related?.some((entry) =>
      entry.relation.kind === "uses"
      && entry.symbol.name === "Gradebook"
      && normalizeRepoPath(entry.symbol.path) === "app/services/scoring/gradebook.rb"
    )).toBeTrue();
    expect(showPayload.related?.some((entry) =>
      entry.relation.kind === "uses"
      && entry.symbol.name === "Student"
      && normalizeRepoPath(entry.symbol.path) === "app/models/student.rb"
    )).toBeTrue();
    expect(graphPayload.graph?.uses.some((entry) =>
      entry.symbol.name === "Gradebook"
      && normalizeRepoPath(entry.symbol.path) === "app/services/scoring/gradebook.rb"
    )).toBeTrue();
    expect(graphPayload.graph?.uses.some((entry) =>
      entry.symbol.name === "Student"
      && normalizeRepoPath(entry.symbol.path) === "app/models/student.rb"
    )).toBeTrue();
  });

  test("ruby autoload resolution can infer graph edges to app/lib namespaced constants", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "lib", "sis", "v2", "services", "writing"), { recursive: true });
    await mkdir(join(root, "app", "services", "scoring"), { recursive: true });
    await writeFile(
      join(root, "app", "lib", "sis", "v2", "services", "writing", "student.rb"),
      [
        "module Sis",
        "  module V2",
        "    module Services",
        "      module Writing",
        "        class Student",
        "        end",
        "      end",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "app", "services", "scoring", "submit_parts.rb"),
      [
        "module Scoring",
        "  class SubmitParts",
        "    def call",
        "      Sis::V2::Services::Writing::Student.new",
        "    end",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const showPayload = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "Scoring::SubmitParts");
    })) as {
      relations?: Array<{ kind: string; targetLabel: string; targetPath: string | null }>;
    };

    expect(showPayload.relations?.some((relation) =>
      relation.kind === "uses"
      && relation.targetLabel === "Sis::V2::Services::Writing::Student"
      && normalizeRepoPath(relation.targetPath) === "app/lib/sis/v2/services/writing/student.rb"
    )).toBeTrue();
  });

  test("ruby include concerns create cross-file graph edges", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "app", "models"), { recursive: true });
    await mkdir(join(root, "app", "models", "concerns"), { recursive: true });
    await writeFile(
      join(root, "app", "models", "concerns", "kid_searchable.rb"),
      [
        "module KidSearchable",
        "  def search_by_keyword_and_school(keyword, school)",
        "    [keyword, school]",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "app", "models", "kid.rb"),
      [
        "class Kid < ApplicationRecord",
        "  include KidSearchable",
        "",
        "  def active?",
        "    true",
        "  end",
        "end"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const kidGraphPayload = JSON.parse(await captureConsoleLog(async () => {
      await runGraph(root, "", "Kid");
    })) as {
      graph?: {
        uses: Array<{ relation: { kind: string }; symbol: { name: string; path: string } }>;
      };
    };

    const concernGraphPayload = JSON.parse(await captureConsoleLog(async () => {
      await runGraph(root, "", "KidSearchable");
    })) as {
      graph?: {
        usedBy: Array<{ relation: { kind: string }; symbol: { name: string; path: string } }>;
      };
    };

    expect(kidGraphPayload.graph?.uses.some((entry) =>
      entry.relation.kind === "uses"
      && entry.symbol.name === "KidSearchable"
      && normalizeRepoPath(entry.symbol.path) === "app/models/concerns/kid_searchable.rb"
    )).toBeTrue();
    expect(concernGraphPayload.graph?.usedBy.some((entry) =>
      entry.relation.kind === "uses"
      && entry.symbol.name === "Kid"
      && normalizeRepoPath(entry.symbol.path) === "app/models/kid.rb"
    )).toBeTrue();
  });

  test("frontend JS and CSS participate in graph relations and diagnostics for fuzzy implementation queries", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "dashboard_frontend", "core"), { recursive: true });
    await mkdir(join(root, "static", "css"), { recursive: true });
    await writeFile(
      join(root, "dashboard_frontend", "core", "workspace.js"),
      [
        'import "../styles.js";',
        "",
        "export function switchWorkspace() {",
        "  return renderWorkspacePanel();",
        "}",
        "",
        "export function renderWorkspacePanel() {",
        '  return "workspace switching flow";',
        "}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "dashboard_frontend", "styles.js"),
      [
        'import "../static/css/dashboard.css";',
        "",
        "export function installDashboardStyles() {",
        "  return true;",
        "}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "dashboard_frontend", "core", "coordinator.js"),
      [
        'import { switchWorkspace } from "./workspace.js";',
        "",
        "export class DashboardCoordinator {",
        "  runWorkspaceFlow() {",
        "    return switchWorkspace();",
        "  }",
        "}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "static", "css", "dashboard.css"),
      [
        ".loading-card {",
        "  display: block;",
        "}"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const queryPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "workspace switching flow", 5, [], {
        codeOnly: true,
        excludeTests: true,
        preferImplementation: true
      });
    })) as {
      resultQuality: {
        noStrongMatch: boolean;
      };
      results: Array<{
        path: string;
        graphSignals: string[];
        graphDiagnostics?: {
          disconnectedFromIndexedGraph: boolean;
          possibleOrphanCandidate: boolean;
        };
      }>;
    };

    const broaderFrontendQueryPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "how does the dashboard switch work when changing workspaces", 5, [], {
        codeOnly: true,
        excludeTests: true,
        preferImplementation: true
      });
    })) as {
      resultQuality: {
        noStrongMatch: boolean;
      };
      results: Array<{
        path: string;
      }>;
    };

    const lookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "switchWorkspace", 5, [], {});
    })) as {
      symbol?: {
        path: string;
        graphDiagnostics: {
          knownInboundReferences: number;
          knownOutboundReferences: number;
          disconnectedFromIndexedGraph: boolean;
          possibleOrphanCandidate: boolean;
          possibleOrphanReasons: string[];
          notes: string[];
        };
      };
    };

    const cssPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, ".loading-card", 5, [], {});
    })) as {
      symbol?: {
        path: string;
        graphDiagnostics: {
          knownInboundReferences: number;
          rootLike: boolean;
          possibleOrphanCandidate: boolean;
        };
      };
    };

    expect(normalizeRepoPath(queryPayload.results[0]?.path)).toBe("dashboard_frontend/core/workspace.js");
    expect(queryPayload.resultQuality.noStrongMatch).toBeFalse();
    expect(normalizeRepoPath(broaderFrontendQueryPayload.results[0]?.path)).toBe("dashboard_frontend/core/workspace.js");
    expect(broaderFrontendQueryPayload.resultQuality.noStrongMatch).toBeFalse();
    expect(queryPayload.results.some((result) => result.graphSignals.includes("imported_by_candidate") || result.graphSignals.includes("used_by_candidate"))).toBeTrue();
    expect(lookupPayload.symbol?.graphDiagnostics.knownInboundReferences).toBeGreaterThan(0);
    expect(lookupPayload.symbol?.graphDiagnostics.knownOutboundReferences).toBeGreaterThan(0);
    expect(lookupPayload.symbol?.graphDiagnostics.disconnectedFromIndexedGraph).toBeFalse();
    expect(lookupPayload.symbol?.graphDiagnostics.possibleOrphanCandidate).toBeFalse();
    expect(lookupPayload.symbol?.graphDiagnostics.possibleOrphanReasons).toHaveLength(0);
    expect(normalizeRepoPath(cssPayload.symbol?.path)).toBe("static/css/dashboard.css");
    expect(cssPayload.symbol?.graphDiagnostics.knownInboundReferences).toBeGreaterThan(0);
    expect(cssPayload.symbol?.graphDiagnostics.rootLike).toBeTrue();
    expect(cssPayload.symbol?.graphDiagnostics.possibleOrphanCandidate).toBeFalse();
  });

  test("indexes config and ops languages with useful lightweight symbols", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "config"), { recursive: true });
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "styles"), { recursive: true });
    await writeFile(
      join(root, "config", "pipeline.yaml"),
      [
        "services:",
        "  api:",
        "    image: app:latest",
        "jobs:",
        "  build:",
        "    steps:",
        "      - run: bun test"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "scripts", "deploy.sh"),
      [
        "#!/usr/bin/env bash",
        "",
        "deploy_app() {",
        "  echo deploy",
        "}",
        "",
        "cleanup() {",
        "  echo cleanup",
        "}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "Dockerfile"),
      [
        "FROM python:3.11-slim AS builder",
        "WORKDIR /app",
        "COPY requirements.txt ./requirements.txt",
        "RUN pip install -r requirements.txt && mkdir -p /tmp/cache",
        "ARG APP_ENV=prod",
        "",
        "FROM nginx:alpine AS runtime",
        "ENV PORT=8080"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "Dockerfile.dashboard"),
      [
        "FROM node:20-alpine AS dashboard",
        "WORKDIR /app",
        "COPY package.json ./package.json",
        "RUN npm ci"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "Containerfile.dev"),
      [
        "FROM python:3.11-slim AS dev",
        "WORKDIR /workspace",
        "RUN pip install -U pip"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "styles", "site.css"),
      [
        ".search-panel {",
        "  display: flex;",
        "}",
        "",
        ".section-header {",
        "  font-weight: 700;",
        "}",
        "",
        "#app-root,",
        ".layout-main {",
        "  color: red;",
        "}",
        "",
        "@media (max-width: 640px) {",
        "  .search-panel {",
        "    display: block;",
        "  }",
        "}"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    const stats = await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const yamlResults = searchSymbols(db, buildFtsQuery("services.api"), 5, { rawQuery: "services.api" });
    const shellResults = searchSymbols(db, buildFtsQuery("deploy_app"), 5, { rawQuery: "deploy_app" });
    const dockerFileResults = searchSymbols(db, buildFtsQuery("Dockerfile"), 5, { rawQuery: "Dockerfile" });
    const dockerResults = searchSymbols(db, buildFtsQuery("builder"), 5, { rawQuery: "builder" });
    const dockerInstructionResults = searchSymbols(db, buildFtsQuery("COPY requirements pip install"), 5, { rawQuery: "COPY requirements pip install" });
    const dockerBaseImageResults = searchSymbols(db, buildFtsQuery("FROM python base image RUN mkdir"), 5, { rawQuery: "FROM python base image RUN mkdir" });
    const dockerDotfileResults = searchSymbols(db, buildFtsQuery("Dockerfile.dashboard"), 5, { rawQuery: "Dockerfile.dashboard" });
    const containerDotfileResults = searchSymbols(db, buildFtsQuery("Containerfile.dev"), 5, { rawQuery: "Containerfile.dev" });
    const cssResults = searchSymbols(db, buildFtsQuery("search-panel"), 5, { rawQuery: "search-panel" });
    const cssSelectorResults = searchSymbols(db, buildFtsQuery(".section-header"), 5, { rawQuery: ".section-header" });
    db.close();

    expect(stats.discoveredFiles).toBe(13);
    expect(yamlResults[0]?.language).toBe("yaml");
    expect(yamlResults[0]?.kind).toBe("key");
    expect(shellResults[0]?.language).toBe("shell");
    expect(shellResults[0]?.kind).toBe("function");
    expect(dockerFileResults[0]?.language).toBe("dockerfile");
    expect(dockerFileResults[0]?.kind).toBe("file");
    expect(dockerFileResults[0]?.name).toBe("Dockerfile");
    expect(dockerResults[0]?.language).toBe("dockerfile");
    expect(dockerResults[0]?.kind).toBe("stage");
    expect(dockerInstructionResults[0]?.language).toBe("dockerfile");
    expect(["file", "copy", "run"]).toContain(dockerInstructionResults[0]?.kind ?? "");
    expect(dockerBaseImageResults[0]?.language).toBe("dockerfile");
    expect(dockerDotfileResults[0]?.language).toBe("dockerfile");
    expect(normalizeRepoPath(dockerDotfileResults[0]?.path)).toBe("Dockerfile.dashboard");
    expect(containerDotfileResults[0]?.language).toBe("dockerfile");
    expect(normalizeRepoPath(containerDotfileResults[0]?.path)).toBe("Containerfile.dev");
    expect(cssResults.some((result) => result.language === "css" && result.kind === "selector")).toBeTrue();
    expect(cssSelectorResults[0]?.language).toBe("css");
    expect(cssSelectorResults[0]?.kind).toBe("selector");
    expect(cssSelectorResults[0]?.name).toBe(".section-header");

    const currentFiles = await listSourceFiles(root);
    expect(currentFiles.some((file) => normalizeRepoPath(file.relativePath) === "Dockerfile" && file.language === "dockerfile")).toBeTrue();
    expect(currentFiles.some((file) => normalizeRepoPath(file.relativePath) === "Dockerfile.dashboard" && file.language === "dockerfile")).toBeTrue();
    expect(currentFiles.some((file) => normalizeRepoPath(file.relativePath) === "Containerfile.dev" && file.language === "dockerfile")).toBeTrue();

    const status = JSON.parse(await captureConsoleLog(async () => {
      await runStatus(root);
    })) as {
      supportedLanguages: string[];
    };

    expect(status.supportedLanguages).toContain("yaml");
    expect(status.supportedLanguages).toContain("shell");
    expect(status.supportedLanguages).toContain("dockerfile");
    expect(status.supportedLanguages).toContain("css");
  });

  test("indexes extensionless shell scripts without pulling in arbitrary extensionless text files", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "notes"), { recursive: true });
    await writeFile(
      join(root, "scripts", "startup"),
      [
        "#!/usr/bin/env bash",
        "set -eu",
        "",
        "start_stack() {",
        "  export APP_ENV=dev",
        "  exec bun run serve",
        "}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "notes", "runbook"),
      [
        "startup checklist",
        "verify logs",
        "call team if needed"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    const stats = await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const shellResults = searchSymbols(db, buildFtsQuery("start_stack"), 5, { rawQuery: "start_stack" });
    db.close();

    expect(stats.discoveredFiles).toBe(8);
    expect(shellResults[0]?.language).toBe("shell");
    expect(shellResults[0]?.kind).toBe("function");
    expect(shellResults[0]?.path).toBe("scripts/startup");

    const currentFiles = await listSourceFiles(root);
    expect(currentFiles.some((file) => normalizeRepoPath(file.relativePath) === "scripts/startup" && file.language === "shell")).toBeTrue();
    expect(currentFiles.some((file) => normalizeRepoPath(file.relativePath) === "notes/runbook")).toBeFalse();
  });

  test("lookup resolves declarative symbols by exact name or signature", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "config"), { recursive: true });
    await mkdir(join(root, "styles"), { recursive: true });
    await writeFile(
      join(root, "config", "docker-compose.yml"),
      [
        "services:",
        "  api:",
        "    image: symballist:latest"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "Dockerfile"),
      [
        "FROM node:20-alpine AS builder",
        "WORKDIR /app",
        "COPY package.json ./package.json",
        "RUN npm ci"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "styles", "site.css"),
      [
        ".section-header {",
        "  font-weight: 700;",
        "}"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const cssLookup = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, ".section-header", 5);
    })) as {
      selectedResult?: { name?: string; kind?: string; path?: string };
      resultQuality?: { level?: string };
    };
    expect(cssLookup.selectedResult?.name).toBe(".section-header");
    expect(cssLookup.selectedResult?.kind).toBe("selector");
    expect(normalizeRepoPath(cssLookup.selectedResult?.path)).toBe("styles/site.css");
    expect(cssLookup.resultQuality?.level).toBe("strong");

    const yamlLookup = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "services.api.image", 5);
    })) as {
      selectedResult?: { name?: string; kind?: string; path?: string };
    };
    expect(yamlLookup.selectedResult?.name).toBe("services.api.image");
    expect(yamlLookup.selectedResult?.kind).toBe("key");
    expect(normalizeRepoPath(yamlLookup.selectedResult?.path)).toBe("config/docker-compose.yml");

    const dockerLookup = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "WORKDIR /app", 5);
    })) as {
      selectedResult?: { kind?: string; signature?: string | null; path?: string };
      resultQuality?: { level?: string };
    };
    expect(dockerLookup.selectedResult?.kind).toBe("workdir");
    expect(dockerLookup.selectedResult?.signature).toBe("WORKDIR /app");
    expect(normalizeRepoPath(dockerLookup.selectedResult?.path)).toBe("Dockerfile");
    expect(dockerLookup.resultQuality?.level).toBe("strong");
  });

  test("lookup tolerates quoted declarative symbol names for css selectors and yaml keys", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "config"), { recursive: true });
    await mkdir(join(root, "styles"), { recursive: true });
    await writeFile(
      join(root, "config", "docker-compose.yml"),
      [
        "services:",
        "  api:",
        "    image: symballist:latest"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "styles", "site.css"),
      [
        ".loading-card {",
        "  opacity: 1;",
        "}"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const quotedCssLookup = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "\".loading-card\"", 5);
    })) as {
      selectedResult?: { name?: string; kind?: string; path?: string };
      resultQuality?: { level?: string };
    };
    expect(quotedCssLookup.selectedResult?.name).toBe(".loading-card");
    expect(quotedCssLookup.selectedResult?.kind).toBe("selector");
    expect(normalizeRepoPath(quotedCssLookup.selectedResult?.path)).toBe("styles/site.css");
    expect(quotedCssLookup.resultQuality?.level).toBe("strong");

    const quotedYamlLookup = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "'services.api.image'", 5);
    })) as {
      selectedResult?: { name?: string; kind?: string; path?: string };
      resultQuality?: { level?: string };
    };
    expect(quotedYamlLookup.selectedResult?.name).toBe("services.api.image");
    expect(quotedYamlLookup.selectedResult?.kind).toBe("key");
    expect(normalizeRepoPath(quotedYamlLookup.selectedResult?.path)).toBe("config/docker-compose.yml");
    expect(quotedYamlLookup.resultQuality?.level).toBe("strong");
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
      extractionSummary: {
        parsed: number;
        recovered: number;
        fallback: number;
        byLanguage: Array<{
          language: string;
          total: number;
          parsed: number;
          recovered: number;
          fallback: number;
        }>;
      };
      indexedSchemaVersion: number | null;
      currentIndexFormatVersion: number;
      indexedIndexFormatVersion: number | null;
      indexCompatibility: {
        currentIndexFormatVersion: number;
        indexedIndexFormatVersion: number | null;
        requiresRebuild: boolean;
      };
      indexFreshness: {
        stale: boolean;
        changedFiles: number;
        newFiles: number;
        deletedFiles: number;
      };
      watchOwnership: {
        present: boolean;
        active: boolean;
        stale: boolean;
        pid: number | null;
        startedAt: string | null;
        lastHeartbeatAt: string | null;
        intervalMs: number | null;
        mode: "once" | "continuous" | null;
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
        symbolChangesSinceIndex: {
          addedCount: number;
          removedCount: number;
          changedCount: number;
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
    expect(status.indexedSymbols).toBe(15);
    expect(status.fallbackSymbols).toBe(1);
    expect(status.extractionSummary.parsed).toBe(14);
    expect(status.extractionSummary.recovered).toBe(0);
    expect(status.extractionSummary.fallback).toBe(1);
    expect(status.extractionSummary.byLanguage.reduce((sum, entry) => sum + entry.fallback, 0)).toBe(1);
    expect(status.extractionSummary.byLanguage.some((entry) => entry.language === "python" && entry.parsed > 0)).toBeTrue();
    expect(status.indexedSchemaVersion).toBeGreaterThan(0);
    expect(status.currentIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION);
    expect(status.indexedIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION);
    expect(status.indexCompatibility.currentIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION);
    expect(status.indexCompatibility.indexedIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION);
    expect(status.indexCompatibility.requiresRebuild).toBeFalse();
    expect(status.indexFreshness.stale).toBeFalse();
    expect(status.watchOwnership.present).toBeFalse();
    expect(status.watchOwnership.active).toBeFalse();
    expect(status.changeAwareness.sinceIndex.changedFiles).toBe(0);
    expect(status.changeAwareness.sinceIndex.newFiles).toBe(0);
    expect(status.changeAwareness.sinceIndex.deletedFiles).toBe(0);
    expect(status.changeAwareness.symbolChangesSinceIndex.addedCount).toBe(0);
    expect(status.changeAwareness.symbolChangesSinceIndex.removedCount).toBe(0);
    expect(status.changeAwareness.symbolChangesSinceIndex.changedCount).toBe(0);
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

  test("import relations resolve package submodule imports to actionable module paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "symballist-"));
    tempRoots.push(root);
    await mkdir(join(root, "pkg"), { recursive: true });
    await writeFile(join(root, "pkg", "__init__.py"), "", "utf8");
    await writeFile(
      join(root, "pkg", "helpers.py"),
      'def slugify(value: str) -> str:\n    return value.lower().replace(" ", "-")\n',
      "utf8"
    );
    await writeFile(
      join(root, "app.py"),
      'from pkg import helpers\n\n\ndef greet(name: str) -> str:\n    return helpers.slugify(name)\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const greet = getBestSymbolByName(db, "greet");
    const relationsFromDb = greet ? getRelationsForSymbol(db, greet) : [];
    db.close();

    expect(relationsFromDb.some((relation) => relation.kind === "imports" && relation.targetLabel === "pkg.helpers" && normalizeRepoPath(relation.targetPath) === "pkg/helpers.py")).toBeTrue();

    const output = await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5);
    });
    const payload = JSON.parse(output) as {
      relations: Array<{
        kind: string;
        targetPath: string | null;
        targetLabel: string;
      }>;
    };

    expect(payload.relations.some((relation) => relation.kind === "imports" && relation.targetLabel === "pkg.helpers" && normalizeRepoPath(relation.targetPath) === "pkg/helpers.py")).toBeTrue();
  });

  test("show and related-symbol flows surface lightweight usage relations", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const buildMessage = getBestSymbolByName(db, "build_message");
    const relationsFromDb = buildMessage ? getRelationsForSymbol(db, buildMessage) : [];
    const relatedFromDb = buildMessage ? getRelatedSymbolsForSymbol(db, buildMessage) : [];
    db.close();

    expect(buildMessage).toBeDefined();
    expect(relationsFromDb.some((relation) => relation.kind === "uses" && relation.targetLabel === "helpers.slugify" && normalizeRepoPath(relation.targetPath) === "helpers.py")).toBeTrue();
    expect(relatedFromDb.some((entry) => entry.relation.kind === "uses" && entry.symbol.name === "slugify" && normalizeRepoPath(entry.symbol.path) === "helpers.py")).toBeTrue();

    const output = await captureConsoleLog(async () => {
      await runShow(root, "", "build_message");
    });
    const payload = JSON.parse(output) as {
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
          name: string;
          path: string;
        };
      }>;
    };

    expect(payload.relations.some((relation) => relation.kind === "uses" && relation.targetLabel === "helpers.slugify" && normalizeRepoPath(relation.targetPath) === "helpers.py")).toBeTrue();
    expect(payload.related.some((entry) => entry.relation.kind === "uses" && entry.symbol.name === "slugify" && normalizeRepoPath(entry.symbol.path) === "helpers.py")).toBeTrue();
  });

  test("graph command groups outbound and inbound traversal neighbors", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "consumer.py"),
      [
        "from helpers import slugify",
        "",
        "def render_slug(name: str) -> str:",
        "    return slugify(name)"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const output = await captureConsoleLog(async () => {
      await runGraph(root, "", "slugify");
    });
    const payload = JSON.parse(output) as {
      symbol: {
        name: string;
      };
      graph: {
        imports: Array<{ symbol: { name: string; path: string; body: string }; bodyPresentation: { mode: string; fullerBodyAvailable: boolean } }>;
        uses: Array<{ symbol: { name: string; path: string; body: string }; bodyPresentation: { mode: string; fullerBodyAvailable: boolean } }>;
        importedBy: Array<{ symbol: { name: string; path: string; body: string }; bodyPresentation: { mode: string; fullerBodyAvailable: boolean } }>;
        usedBy: Array<{ symbol: { name: string; path: string; body: string }; bodyPresentation: { mode: string; fullerBodyAvailable: boolean } }>;
        containedIn: Array<{ symbol: { name: string; path: string; body: string }; bodyPresentation: { mode: string; fullerBodyAvailable: boolean } }>;
      };
      graphSummary: {
        totalEdges: number;
        neighborBodyMode: string;
      };
    };

    expect(payload.symbol.name).toBe("slugify");
    expect(payload.graph.importedBy.some((entry) => entry.symbol.name === "build_message" && normalizeRepoPath(entry.symbol.path) === "app.py")).toBeTrue();
    expect(payload.graph.usedBy.some((entry) => entry.symbol.name === "build_message" && normalizeRepoPath(entry.symbol.path) === "app.py")).toBeTrue();
    expect(payload.graph.importedBy.some((entry) => entry.symbol.name === "render_slug" && normalizeRepoPath(entry.symbol.path) === "src/consumer.py")).toBeTrue();
    expect(payload.graph.usedBy.some((entry) => entry.symbol.name === "render_slug" && normalizeRepoPath(entry.symbol.path) === "src/consumer.py")).toBeTrue();
    expect(payload.graph.imports.length).toBe(0);
    expect(payload.graph.uses.length).toBe(0);
    expect(payload.graph.containedIn.length).toBe(0);
    expect(payload.graph.importedBy.every((entry) => typeof entry.bodyPresentation.mode === "string")).toBeTrue();
    expect(payload.graph.importedBy.every((entry) => typeof entry.symbol.body === "string")).toBeTrue();
    expect(payload.graphSummary.neighborBodyMode).toBe("summary");
    expect(payload.graphSummary.totalEdges).toBeGreaterThanOrEqual(4);
  });

  test("graph --full expands neighbor bodies inline for deep traversal reads", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "consumer.py"),
      [
        "from helpers import slugify",
        "",
        "def render_slug(name: str) -> str:",
        '    formatted = slugify(name)',
        '    return f"slug:{formatted}"'
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const output = await captureConsoleLog(async () => {
      await runGraph(root, "", "slugify", { full: true });
    });
    const payload = JSON.parse(output) as {
      graph: {
        importedBy: Array<{
          symbol: {
            name: string;
            body: string;
          };
          bodyPresentation: {
            mode: string;
            truncated: boolean;
            fullerBodyAvailable: boolean;
          };
        }>;
      };
      graphSummary: {
        neighborBodyMode: string;
      };
    };

    const renderSlug = payload.graph.importedBy.find((entry) => entry.symbol.name === "render_slug");
    expect(renderSlug).toBeDefined();
    expect(renderSlug?.bodyPresentation.mode).toBe("full");
    expect(renderSlug?.bodyPresentation.truncated).toBeFalse();
    expect(renderSlug?.bodyPresentation.fullerBodyAvailable).toBeFalse();
    expect(renderSlug?.symbol.body).toContain('return f"slug:{formatted}"');
    expect(payload.graphSummary.neighborBodyMode).toBe("full");
  });

  test("graph compact mode strips neighbor bodies and keeps grouped collections list-typed", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "consumer.py"),
      [
        "from helpers import slugify",
        "",
        "def render_slug(name: str) -> str:",
        "    return slugify(name)"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const output = await captureConsoleLog(async () => {
      await runGraph(root, "", "slugify", { compact: true });
    });
    const payload = JSON.parse(output) as {
      symbol: {
        name: string;
        body?: string;
      };
      graph: {
        imports: Array<{ symbol: { name: string; body?: string } }>;
        uses: Array<{ symbol: { name: string; body?: string } }>;
        importedBy: Array<{ symbol: { name: string; body?: string } }>;
        usedBy: Array<{ symbol: { name: string; body?: string } }>;
        containedIn: Array<{ symbol: { name: string; body?: string } }>;
      };
      graphSummary: {
        totalEdges: number;
      };
    };

    expect(payload.symbol.name).toBe("slugify");
    expect("body" in payload.symbol).toBeFalse();
    expect(Array.isArray(payload.graph.imports)).toBeTrue();
    expect(Array.isArray(payload.graph.uses)).toBeTrue();
    expect(Array.isArray(payload.graph.importedBy)).toBeTrue();
    expect(Array.isArray(payload.graph.usedBy)).toBeTrue();
    expect(Array.isArray(payload.graph.containedIn)).toBeTrue();
    expect(payload.graph.importedBy.length).toBeGreaterThan(0);
    expect(payload.graph.importedBy.every((entry) => !("body" in entry.symbol))).toBeTrue();
    expect(payload.graph.usedBy.every((entry) => !("body" in entry.symbol))).toBeTrue();
    expect(payload.graphSummary.totalEdges).toBeGreaterThanOrEqual(payload.graph.importedBy.length + payload.graph.usedBy.length);
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
      resultQuality: {
        level: string;
        noStrongMatch: boolean;
      };
      retrieval: {
        mode: string;
      };
      results: Array<{
        name: string;
        path: string;
        file: { path: string; language: string };
        location: { path: string; startLine: number };
      }>;
    };

    const lookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5, [], {}, { compact: true });
    })) as {
      resultSemantics?: unknown;
      trustSemantics?: unknown;
      resultQuality: {
        level: string;
        noStrongMatch: boolean;
      };
      selectedResult: {
        name: string;
        path: string;
        file: { path: string; language: string };
        location: { path: string; startLine: number };
      } | null;
      symbol: {
        name: string;
        path: string;
        file: { path: string; language: string };
        location: { path: string; startLine: number };
      } | null;
    };

    const showPayload = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "greet", { compact: true });
    })) as {
      trustSemantics?: unknown;
      symbol: { name: string };
      bodyPresentation: { mode: string };
    };

    expect(queryPayload.resultSemantics).toBeUndefined();
    expect(queryPayload.resultQuality.level).toBe("strong");
    expect(queryPayload.resultQuality.noStrongMatch).toBeFalse();
    expect(queryPayload.retrieval.mode).toBe("lexical");
    expect(queryPayload.results[0]?.name).toBe("greet");
    expect(normalizeRepoPath(queryPayload.results[0]?.file.path)).toBe(normalizeRepoPath(queryPayload.results[0]?.path));
    expect(normalizeRepoPath(queryPayload.results[0]?.location.path)).toBe(normalizeRepoPath(queryPayload.results[0]?.path));
    expect(queryPayload.results[0]?.location.startLine).toBeGreaterThan(0);

    expect(lookupPayload.resultSemantics).toBeUndefined();
    expect(lookupPayload.trustSemantics).toBeUndefined();
    expect(lookupPayload.resultQuality.level).toBe("strong");
    expect(lookupPayload.resultQuality.noStrongMatch).toBeFalse();
    expect(lookupPayload.selectedResult?.name).toBe("greet");
    expect(lookupPayload.symbol?.name).toBe("greet");
    expect(normalizeRepoPath(lookupPayload.selectedResult?.file.path)).toBe(normalizeRepoPath(lookupPayload.selectedResult?.path));
    expect(normalizeRepoPath(lookupPayload.symbol?.location.path)).toBe(normalizeRepoPath(lookupPayload.symbol?.path));

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
        fullerBodyAvailable: boolean;
        expansionHint: string | null;
      };
      symbol: {
        body: string;
      };
    };

    const lookupSummaryOutput = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "MemoryStore", 5);
    })) as {
      bodyPresentation: {
        mode: string;
        truncated: boolean;
        fullerBodyAvailable: boolean;
        expansionHint: string | null;
      } | null;
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
    expect(summaryOutput.bodyPresentation.fullerBodyAvailable).toBeTrue();
    expect(summaryOutput.bodyPresentation.expansionHint).toContain("--full");
    expect(summaryOutput.symbol.body).toContain("[truncated, rerun show with --full");
    expect(lookupSummaryOutput.bodyPresentation?.mode).toBe("summary");
    expect(lookupSummaryOutput.bodyPresentation?.fullerBodyAvailable).toBeTrue();
    expect(lookupSummaryOutput.bodyPresentation?.expansionHint).toContain("--full");
    expect(fullOutput.bodyPresentation.mode).toBe("full");
    expect(fullOutput.bodyPresentation.truncated).toBeFalse();
    expect(fullOutput.symbol.body).toContain("field_119");
  });

  test("status reports when stored index content requires a full rebuild", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    db.query("UPDATE metadata SET value = ? WHERE key = 'index_format_version'").run(String(CURRENT_INDEX_FORMAT_VERSION - 1));
    db.close();

    const output = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(output) as {
      currentIndexFormatVersion: number;
      indexedIndexFormatVersion: number | null;
      indexCompatibility: {
        currentIndexFormatVersion: number;
        indexedIndexFormatVersion: number | null;
        requiresRebuild: boolean;
      };
    };

    expect(status.currentIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION);
    expect(status.indexedIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION - 1);
    expect(status.indexCompatibility.currentIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION);
    expect(status.indexCompatibility.indexedIndexFormatVersion).toBe(CURRENT_INDEX_FORMAT_VERSION - 1);
    expect(status.indexCompatibility.requiresRebuild).toBeTrue();
  });

  test("parsed large code symbols keep full stored bodies so --full materially expands them", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    const parsedLargeBody = [
      "class EmbeddingService:",
      "    \"\"\"Parsed large body for full-storage testing.\"\"\"",
      ...Array.from({ length: 234 }, (_, index) => `    def method_${index}(self):\n        return ${index}`)
    ].join("\n");

    await writeFile(join(root, "src", "embedding_service.py"), parsedLargeBody, "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    const summaryOutput = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "EmbeddingService");
    })) as {
      symbol: {
        body: string;
        extraction: string;
      };
      bodyPresentation: {
        mode: string;
        truncated: boolean;
        fullerBodyAvailable: boolean;
      };
    };

    const fullOutput = JSON.parse(await captureConsoleLog(async () => {
      await runShow(root, "", "EmbeddingService", { full: true });
    })) as {
      symbol: {
        body: string;
        extraction: string;
      };
      bodyPresentation: {
        mode: string;
        truncated: boolean;
      };
    };

    expect(summaryOutput.symbol.extraction).toBe("parsed");
    expect(summaryOutput.bodyPresentation.mode).toBe("summary");
    expect(summaryOutput.bodyPresentation.truncated).toBeTrue();
    expect(summaryOutput.bodyPresentation.fullerBodyAvailable).toBeTrue();
    expect(summaryOutput.symbol.body.length).toBeLessThan(fullOutput.symbol.body.length);
    expect(fullOutput.symbol.extraction).toBe("parsed");
    expect(fullOutput.bodyPresentation.mode).toBe("full");
    expect(fullOutput.bodyPresentation.truncated).toBeFalse();
    expect(fullOutput.symbol.body).toContain("method_120");
    expect(fullOutput.symbol.body).toContain("method_233");
  });

  test("index auto-rebuilds unchanged files when stored index format is outdated", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    const parsedLargeBody = [
      "class EmbeddingService:",
      "    \"\"\"Parsed large body for rebuild testing.\"\"\"",
      ...Array.from({ length: 120 }, (_, index) => `    def method_${index}(self):\n        return ${index}`)
    ].join("\n");

    await writeFile(join(root, "src", "embedding_service.py"), parsedLargeBody, "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const before = getBestSymbolByName(db, "EmbeddingService");
    expect(before).toBeDefined();
    db.query("UPDATE symbols SET body = ? WHERE id = ?").run("class EmbeddingService:\n    pass", before?.id);
    db.query("UPDATE metadata SET value = ? WHERE key = 'index_format_version'").run(String(CURRENT_INDEX_FORMAT_VERSION - 1));
    db.close();

    const rebuildStats = await runIndex(root, { progress: false });
    expect(rebuildStats.indexedFiles).toBeGreaterThan(0);
    expect(rebuildStats.skippedFiles).toBe(0);

    const rebuiltDb = await openDatabase(root);
    const after = getBestSymbolByName(rebuiltDb, "EmbeddingService");
    const storedVersion = rebuiltDb.query("SELECT value FROM metadata WHERE key = 'index_format_version'").get() as { value: string } | null;
    rebuiltDb.close();

    expect(after).toBeDefined();
    expect((after?.body.length ?? 0)).toBeGreaterThan("class EmbeddingService:\n    pass".length);
    expect(after?.body).toContain("method_80");
    expect(Number(storedVersion?.value ?? 0)).toBe(CURRENT_INDEX_FORMAT_VERSION);
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
      resultQuality: {
        level: string;
        reason: string;
        noStrongMatch: boolean;
        strongMatchCount: number;
        resultCount: number;
        topResultConfidence: string | null;
        topResultRetrievalTrustLevel: string | null;
      };
      results: Array<{
        kind: string;
        distance: number;
        score: number | null;
        scoreMarginFromTop: number | null;
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
    expect(queryPayload.resultSemantics.score).toContain("relative 0-1 ranking signal");
    expect(queryPayload.resultQuality.level).toBe("strong");
    expect(queryPayload.resultQuality.reason).toBe("top_result_strong");
    expect(queryPayload.resultQuality.noStrongMatch).toBeFalse();
    expect(queryPayload.resultQuality.strongMatchCount).toBeGreaterThan(0);
    expect(queryPayload.resultQuality.resultCount).toBe(queryPayload.results.length);
    expect(queryPayload.results.length).toBeGreaterThan(0);
    expect(queryPayload.results.every((result) => result.kind === "import")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.distance === "number")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.score === "number")).toBeTrue();
    expect(queryPayload.results.every((result) => typeof result.scoreMarginFromTop === "number")).toBeTrue();
    expect(queryPayload.results[0]?.score).toBe(1);
    expect(queryPayload.results[0]?.scoreMarginFromTop).toBe(0);
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

  test("broad conceptual queries with filler terms still promote canonical src implementations", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "tests"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "src", "memory_store.py"),
      'class MemoryStore:\n    """Stores retrieval context for the pipeline."""\n    pass\n',
      "utf8"
    );
    await writeFile(
      join(root, "src", "memory_notes.py"),
      'def summarize_memory() -> str:\n    return "memory store notes"\n',
      "utf8"
    );
    await writeFile(
      join(root, "tests", "test_memory_store.py"),
      'def test_memory_store_flow():\n    assert "memory store"\n',
      "utf8"
    );
    await writeFile(
      join(root, "docs", "memory-store.md"),
      "# Memory Store\n\nOverview of how the memory store works at a high level.\n",
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, buildFtsQuery("how does memory store work"), 5, {
      rawQuery: "how does memory store work"
    });
    db.close();

    expect(normalizeRepoPath(results[0]?.path)).toBe("src/memory_store.py");
    expect(results[0]?.name).toBe("MemoryStore");
    expect(results[0]?.kind).toBe("class");
    expect(results.some((result) => normalizeRepoPath(result.path) === "docs/memory-store.md")).toBeTrue();
    expect(results.some((result) => normalizeRepoPath(result.path) === "tests/test_memory_store.py")).toBeTrue();
  });

  test("negative path filters suppress legacy or deprecated zones without changing the query", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "_deprecated"), { recursive: true });
    await mkdir(join(root, "legacy"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "_deprecated", "memory.py"),
      [
        "def memory_store():",
        "    return 'deprecated memory store'"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "legacy", "memory.py"),
      [
        "def memory_store_legacy():",
        "    return 'legacy memory store'"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "src", "memory.py"),
      [
        "def memory_store():",
        "    return 'canonical memory store'"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const unfilteredPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "memory store", 5, [], {
        codeOnly: true,
        preferImplementation: true
      });
    })) as {
      results: Array<{ path: string }>;
    };

    const filteredPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "memory store", 5, [], {
        codeOnly: true,
        preferImplementation: true,
        excludePaths: ["_deprecated", "legacy"]
      });
    })) as {
      results: Array<{ path: string }>;
    };

    expect(unfilteredPayload.results.some((result) => normalizeRepoPath(result.path)?.startsWith("_deprecated/"))).toBeTrue();
    expect(unfilteredPayload.results.some((result) => normalizeRepoPath(result.path)?.startsWith("legacy/"))).toBeTrue();
    expect(filteredPayload.results.every((result) => !normalizeRepoPath(result.path)?.startsWith("_deprecated/"))).toBeTrue();
    expect(filteredPayload.results.every((result) => !normalizeRepoPath(result.path)?.startsWith("legacy/"))).toBeTrue();
    expect(normalizeRepoPath(filteredPayload.results[0]?.path)).toBe("src/memory.py");
  });

  test("query diversifies repeated same-file hits and reports grouped file context", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "memory_store.py"),
      [
        "class MemoryStore:",
        "    pass",
        "",
        "def build_memory_store():",
        "    return 'memory store pipeline'",
        "",
        "def summarize_memory_store():",
        "    return 'memory store status'"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(root, "src", "memory_store_cache.py"),
      [
        "class MemoryStoreCache:",
        "    pass",
        "",
        "def memory_store_cache():",
        "    return 'memory store cache'"
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const payload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "memory store", 4, [], {
        codeOnly: true,
        preferImplementation: true
      });
    })) as {
      fileGroups: Array<{
        path: string;
        hitCount: number;
        topKinds: string[];
        topNames: string[];
      }>;
      results: Array<{
        path: string;
        name: string;
      }>;
    };

    const topPaths = payload.results.map((result) => normalizeRepoPath(result.path));
    expect(topPaths[0]).toBe("src/memory_store.py");
    expect(new Set(topPaths.slice(0, 3)).size).toBeGreaterThan(1);
    expect(payload.fileGroups[0]?.path).toBe("src/memory_store.py");
    expect(payload.fileGroups[0]?.hitCount).toBeGreaterThan(1);
    expect(payload.fileGroups[0]?.topNames).toContain("MemoryStore");
    expect(payload.fileGroups.some((group) => normalizeRepoPath(group.path) === "src/memory_store_cache.py")).toBeTrue();
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

  test("query and lookup expose explicit no-strong-match signaling for weak or empty cases", async () => {
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

    await runInit(root);
    await runIndex(root, { progress: false });

    const weakQueryPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "memory ghost cleanup", 5);
    })) as {
      resultQuality: {
        level: string;
        reason: string;
        noStrongMatch: boolean;
        strongMatchCount: number;
        resultCount: number;
        topResultConfidence: string | null;
        topResultRetrievalTrustLevel: string | null;
      };
      results: Array<{ path: string }>;
    };

    const weakLookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(root, "zzzzzz no such symbol", 5);
    })) as {
      resultQuality: {
        level: string;
        reason: string;
        noStrongMatch: boolean;
        strongMatchCount: number;
        resultCount: number;
        topResultConfidence: string | null;
        topResultRetrievalTrustLevel: string | null;
      };
      selectedResult: unknown;
      alternatives: unknown[];
    };

    const blankRoot = await mkdtemp(join(tmpdir(), "symballist-"));
    tempRoots.push(blankRoot);
    await runInit(blankRoot);
    await runIndex(blankRoot, { progress: false });

    const emptyLookupPayload = JSON.parse(await captureConsoleLog(async () => {
      await runLookup(blankRoot, "zzzzqqqqxxxxvvvv", 5);
    })) as {
      resultQuality: {
        level: string;
        reason: string;
        noStrongMatch: boolean;
        strongMatchCount: number;
        resultCount: number;
        topResultConfidence: string | null;
        topResultRetrievalTrustLevel: string | null;
      };
      selectedResult: unknown;
      alternatives: unknown[];
    };

    expect(weakQueryPayload.results.length).toBeGreaterThan(0);
    expect(weakQueryPayload.resultQuality.level).not.toBe("strong");
    expect(weakQueryPayload.resultQuality.noStrongMatch).toBeTrue();
    expect(weakQueryPayload.resultQuality.strongMatchCount).toBe(0);
    expect(weakQueryPayload.resultQuality.resultCount).toBe(weakQueryPayload.results.length);
    expect(["related", "fallback"]).toContain(weakQueryPayload.resultQuality.topResultConfidence ?? "");

    expect(weakLookupPayload.selectedResult).not.toBeNull();
    expect(weakLookupPayload.resultQuality.level).toBe("weak");
    expect(weakLookupPayload.resultQuality.reason).toBe("only_weak_matches");
    expect(weakLookupPayload.resultQuality.noStrongMatch).toBeTrue();
    expect(weakLookupPayload.resultQuality.strongMatchCount).toBe(0);
    expect(weakLookupPayload.resultQuality.topResultConfidence).toBe("fallback");
    expect(weakLookupPayload.resultQuality.topResultRetrievalTrustLevel).toBe("low");

    expect(emptyLookupPayload.selectedResult).toBeNull();
    expect(emptyLookupPayload.alternatives).toEqual([]);
    expect(emptyLookupPayload.resultQuality.level).toBe("none");
    expect(emptyLookupPayload.resultQuality.reason).toBe("no_results");
    expect(emptyLookupPayload.resultQuality.noStrongMatch).toBeTrue();
    expect(emptyLookupPayload.resultQuality.strongMatchCount).toBe(0);
    expect(emptyLookupPayload.resultQuality.resultCount).toBe(0);
    expect(emptyLookupPayload.resultQuality.topResultConfidence).toBeNull();
    expect(emptyLookupPayload.resultQuality.topResultRetrievalTrustLevel).toBeNull();
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

  test("implementation-detail queries can promote body-only code matches over doc noise", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "docs", "pipeline-progress.md"),
      "# Pipeline progress\n\nThis note explains where the pipeline poll for progress loop lives.\n",
      "utf8"
    );
    await writeFile(
      join(root, "src", "runner.py"),
      [
        "def execute_job() -> str:",
        '    """Execute the active run."""',
        "    # poll for progress until the pipeline completes",
        "    pipeline_state = 'running'",
        "    while pipeline_state == 'running':",
        "        pipeline_state = check_progress()",
        '    return "done"',
        "",
        "def check_progress() -> str:",
        '    return "complete"'
      ].join("\n"),
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const queryPayload = JSON.parse(await captureConsoleLog(async () => {
      await runQuery(root, "where does the pipeline poll for progress", 5);
    })) as {
      resultQuality: {
        level: string;
        noStrongMatch: boolean;
      };
      results: Array<{
        path: string;
        language: string;
        name: string;
        matchReason: string;
        confidence: string;
      }>;
    };

    expect(queryPayload.resultQuality.level).toBe("strong");
    expect(queryPayload.resultQuality.noStrongMatch).toBeFalse();
    expect(normalizeRepoPath(queryPayload.results[0]?.path)).toBe("src/runner.py");
    expect(queryPayload.results[0]?.language).toBe("python");
    expect(queryPayload.results[0]?.name).toBe("execute_job");
    expect(queryPayload.results[0]?.matchReason).toBe("body_text");
    expect(queryPayload.results[0]?.confidence).toBe("strong");
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
    expect(results[1]?.graphSignals).toContain("used_by_candidate");
    expect(results.findIndex((result) => normalizeRepoPath(result.path) === "src/store.py")).toBeLessThan(results.findIndex((result) => normalizeRepoPath(result.path) === "src/notes.py"));
  });

  test("status and retrieval surface likely graph roots for startup-oriented code", async () => {
    const root = await mkdtemp(join(tmpdir(), "symballist-"));
    tempRoots.push(root);
    await mkdir(join(root, "scripts"), { recursive: true });
    await writeFile(
      join(root, "worker.py"),
      'def bootstrap_store() -> str:\n    """bootstrap worker flow"""\n    return "ok"\n',
      "utf8"
    );
    await writeFile(
      join(root, "main.py"),
      'from worker import bootstrap_store\n\n\ndef main() -> str:\n    return bootstrap_store()\n',
      "utf8"
    );
    await writeFile(
      join(root, "scripts", "startup"),
      '#!/usr/bin/env bash\nrun_stack() {\n  echo "start"\n}\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const statusOutput = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(statusOutput) as {
      graphAwareness: {
        likelyRoots: Array<{
          path: string;
          language: string;
          reasons: string[];
        }>;
      };
    };

    expect(status.graphAwareness.likelyRoots.some((entry) => normalizeRepoPath(entry.path) === "main.py" && entry.reasons.length > 0)).toBeTrue();
    expect(status.graphAwareness.likelyRoots.some((entry) => normalizeRepoPath(entry.path) === "scripts/startup" && entry.reasons.length > 0)).toBeTrue();

    const db = await openDatabase(root);
    const results = searchSymbols(db, buildFtsQuery("startup main bootstrap"), 5, {
      rawQuery: "startup main bootstrap"
    });
    db.close();

    const mainResult = results.find((result) => normalizeRepoPath(result.path) === "main.py" && result.name === "main");
    expect(mainResult).toBeDefined();
    expect(mainResult?.graphSignals).toContain("root_candidate");
  });

  test("lookup, show, and query expose index-bounded graph diagnostics without dead-code claims", async () => {
    const root = await mkdtemp(join(tmpdir(), "symballist-"));
    tempRoots.push(root);
    await mkdir(join(root, "tests"), { recursive: true });
    await writeFile(
      join(root, "helpers.py"),
      'def test_only_helper() -> str:\n    return "ok"\n',
      "utf8"
    );
    await writeFile(
      join(root, "orphan.py"),
      'def unused_helper() -> str:\n    return "unused"\n',
      "utf8"
    );
    await writeFile(
      join(root, "main.py"),
      'def main() -> str:\n    return "start"\n',
      "utf8"
    );
    await writeFile(
      join(root, "tests", "test_helpers.py"),
      'from helpers import test_only_helper\n\n\ndef test_value() -> str:\n    return test_only_helper()\n',
      "utf8"
    );

    await runInit(root);
    await runIndex(root, { progress: false });

    const statusOutput = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const statusPayload = JSON.parse(statusOutput) as {
      graphAwareness: {
        possibleOrphans: Array<{
          path: string;
          name: string;
          reasons: string[];
        }>;
      };
    };

    expect(statusPayload.graphAwareness.possibleOrphans.some((entry) => normalizeRepoPath(entry.path) === "orphan.py" && entry.name === "unused_helper")).toBeTrue();

    const lookupOutput = await captureConsoleLog(async () => {
      await runLookup(root, "unused_helper", 5);
    });
    const lookupPayload = JSON.parse(lookupOutput) as {
      symbol: {
        graphDiagnostics: {
          knownInboundReferences: number;
          disconnectedFromIndexedGraph: boolean;
          rootLike: boolean;
          possibleOrphanCandidate: boolean;
          possibleOrphanReasons: string[];
          notes: string[];
        };
      } | null;
    };

    expect(lookupPayload.symbol?.graphDiagnostics.knownInboundReferences).toBe(0);
    expect(lookupPayload.symbol?.graphDiagnostics.disconnectedFromIndexedGraph).toBeTrue();
    expect(lookupPayload.symbol?.graphDiagnostics.rootLike).toBeFalse();
    expect(lookupPayload.symbol?.graphDiagnostics.possibleOrphanCandidate).toBeTrue();
    expect(lookupPayload.symbol?.graphDiagnostics.possibleOrphanReasons).toContain("no known inbound references");
    expect(lookupPayload.symbol?.graphDiagnostics.notes.some((note) => note.includes("No known inbound"))).toBeTrue();

    const showOutput = await captureConsoleLog(async () => {
      await runShow(root, "", "test_only_helper");
    });
    const showPayload = JSON.parse(showOutput) as {
      symbol: {
        graphDiagnostics: {
          inboundReferencesFromTestsOnly: boolean;
          knownInboundReferences: number;
          possibleOrphanCandidate: boolean;
          notes: string[];
        };
      };
    };

    expect(showPayload.symbol.graphDiagnostics.knownInboundReferences).toBe(1);
    expect(showPayload.symbol.graphDiagnostics.inboundReferencesFromTestsOnly).toBeTrue();
    expect(showPayload.symbol.graphDiagnostics.possibleOrphanCandidate).toBeFalse();
    expect(showPayload.symbol.graphDiagnostics.notes.some((note) => note.includes("only from test paths"))).toBeTrue();

    const queryOutput = await captureConsoleLog(async () => {
      await runQuery(root, "main startup", 5, [], { codeOnly: true });
    });
    const queryPayload = JSON.parse(queryOutput) as {
      resultSemantics: {
        graphDiagnostics: string;
      };
      results: Array<{
        name: string;
        path: string;
        graphDiagnostics?: {
          rootLike: boolean;
          rootReasons: string[];
          possibleOrphanCandidate: boolean;
        };
      }>;
    };

    const mainResult = queryPayload.results.find((result) => normalizeRepoPath(result.path) === "main.py" && result.name === "main");
    expect(queryPayload.resultSemantics.graphDiagnostics).toContain("not dead-code claims");
    expect(mainResult?.graphDiagnostics?.rootLike).toBeTrue();
    expect(mainResult?.graphDiagnostics?.possibleOrphanCandidate).toBeFalse();
    expect((mainResult?.graphDiagnostics?.rootReasons.length ?? 0)).toBeGreaterThan(0);
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

  test("scope rule changes mark the index stale and one-shot watch reapplies scope", async () => {
    const root = await createFixtureRepo();
    await mkdir(join(root, "submods", "vendor-lib"), { recursive: true });
    await writeFile(join(root, "submods", "vendor-lib", "noise.rb"), "class Noise\nend\n", "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    await writeFile(join(root, ".symballist", "scope.txt"), "submods/\n", "utf8");

    const statusOutput = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(statusOutput) as {
      indexFreshness: {
        stale: boolean;
        scopeChanged: boolean;
      };
      changeAwareness: {
        sinceIndex: {
          deletedFiles: number;
          deletedPaths: string[];
        };
      };
    };

    expect(status.indexFreshness.stale).toBeTrue();
    expect(status.indexFreshness.scopeChanged).toBeTrue();
    expect(status.changeAwareness.sinceIndex.deletedPaths).toContain("submods/vendor-lib/noise.rb");

    const watchOutput = JSON.parse(await captureConsoleLog(async () => {
      await runWatch(root, { once: true });
    })) as {
      event: string;
      reason: string;
      stats: {
        removedFiles: number;
      } | null;
      indexFreshnessAfter: {
        stale: boolean;
        scopeChanged: boolean;
      };
    };

    expect(watchOutput.event).toBe("indexed");
    expect(watchOutput.reason).toBe("stale_index");
    expect(watchOutput.stats?.removedFiles).toBe(1);
    expect(watchOutput.indexFreshnessAfter.stale).toBeFalse();
    expect(watchOutput.indexFreshnessAfter.scopeChanged).toBeFalse();
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

  test("status reports bounded symbol-level changes from the most recent index run", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    await writeFile(
      join(root, "helpers.py"),
      [
        "def slugify(value: str) -> str:",
        "    return value.lower()",
        "",
        "def normalize_slug(value: str) -> str:",
        "    return slugify(value).strip('-')"
      ].join("\n"),
      "utf8"
    );

    await runIndex(root, { progress: false });

    const output = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(output) as {
      changeAwareness: {
        symbolChangesSinceIndex: {
          addedCount: number;
          removedCount: number;
          changedCount: number;
          added: Array<{ path: string; kind: string; name: string }>;
          removed: Array<{ path: string; kind: string; name: string }>;
          changed: Array<{ path: string; kind: string; name: string }>;
          truncated: boolean;
        };
      };
    };

    expect(status.changeAwareness.symbolChangesSinceIndex.addedCount).toBe(1);
    expect(status.changeAwareness.symbolChangesSinceIndex.removedCount).toBe(0);
    expect(status.changeAwareness.symbolChangesSinceIndex.changedCount).toBe(1);
    expect(status.changeAwareness.symbolChangesSinceIndex.added.some((entry) => entry.path === "helpers.py" && entry.name === "normalize_slug")).toBeTrue();
    expect(status.changeAwareness.symbolChangesSinceIndex.changed.some((entry) => entry.path === "helpers.py" && entry.name === "slugify")).toBeTrue();
    expect(status.changeAwareness.symbolChangesSinceIndex.truncated).toBeFalse();
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

  test("oversized javascript files recover top-level classes, methods, and const functions instead of a single file fallback", async () => {
    const root = await createFixtureRepo();
    const oversizedSource = [
      "import * as utils from './utils.js';",
      "",
      "class ClusteringCard {",
      "  initialize() {",
      "    return utils.ready();",
      "  }",
      "}",
      "",
      "export const buildCard = async (label) => {",
      "  return label.trim();",
      "};",
      "",
      "export default ClusteringCard;",
      "",
      "// filler",
      "// filler\n".repeat(5000)
    ].join("\n");

    await writeFile(join(root, "big_component.js"), oversizedSource, "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const results = searchSymbols(db, "ClusteringCard", 10);
    const clusteringCard = results.find((result) => result.name === "ClusteringCard");
    const initializeMethod = searchSymbols(db, "initialize", 10).find((result) => result.kind === "method" && result.path === "big_component.js");
    const buildCard = searchSymbols(db, "buildCard", 10).find((result) => result.kind === "function" && result.path === "big_component.js");
    const fileFallback = results.find((result) => result.path === "big_component.js" && result.kind === "file");
    const details = clusteringCard ? getSymbolById(db, clusteringCard.id) : null;
    db.close();

    expect(clusteringCard).toBeDefined();
    expect(clusteringCard?.kind).toBe("class");
    expect(clusteringCard?.startLine).toBe(3);
    expect(clusteringCard?.extraction).toBe("recovered");
    expect(clusteringCard?.trustLevel).toBe("medium");
    expect(fileFallback).toBeUndefined();
    expect(initializeMethod?.extraction).toBe("recovered");
    expect(initializeMethod?.signature).toContain("ClusteringCard.initialize");
    expect(buildCard?.extraction).toBe("recovered");
    expect(buildCard?.signature).toContain("export const buildCard");
    expect(details?.body).toContain("class ClusteringCard");
    expect(details?.endLine).toBeGreaterThan(clusteringCard?.startLine ?? 0);
  });

  test("oversized ruby files recover top-level modules, classes, methods, and constants instead of a single file fallback", async () => {
    const root = await createFixtureRepo();
    const oversizedSource = [
      'require_relative "./score_helper"',
      "",
      "module Scoring",
      "  class SubmitParts",
      '    STATUS = "active"',
      "",
      "    def self.enqueue(user)",
      "      user",
      "    end",
      "",
      "    def call(part)",
      "      part",
      "    end",
      "  end",
      "end",
      "",
      "# filler",
      "# filler\n".repeat(5000)
    ].join("\n");

    await writeFile(join(root, "big_worker.rb"), oversizedSource, "utf8");
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    const submitParts = searchSymbols(db, "SubmitParts", 10).find((result) => result.kind === "class" && result.path === "big_worker.rb");
    const scoringModule = searchSymbols(db, "Scoring", 10).find((result) => result.kind === "module" && result.path === "big_worker.rb");
    const enqueue = searchSymbols(db, "enqueue", 10).find((result) => result.kind === "method" && result.path === "big_worker.rb");
    const call = searchSymbols(db, "call", 10).find((result) => result.kind === "method" && result.path === "big_worker.rb");
    const statusConstant = searchSymbols(db, "STATUS", 10).find((result) => result.kind === "constant" && result.path === "big_worker.rb");
    const fileFallback = searchSymbols(db, "big_worker.rb", 10).find((result) => result.kind === "file" && result.path === "big_worker.rb");
    const details = submitParts ? getSymbolById(db, submitParts.id) : null;
    db.close();

    expect(scoringModule?.extraction).toBe("recovered");
    expect(submitParts?.extraction).toBe("recovered");
    expect(submitParts?.signature).toContain("class Scoring::SubmitParts");
    expect(enqueue?.signature).toContain("Scoring::SubmitParts.enqueue");
    expect(call?.signature).toContain("Scoring::SubmitParts#call");
    expect(statusConstant?.signature).toContain("Scoring::SubmitParts::STATUS");
    expect(fileFallback).toBeUndefined();
    expect(details?.body).toContain("class SubmitParts");
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
    expect(parsed.languages).toBeNull();
    expect(parsed.autoDetectLanguages).toBeFalse();
    expect(parsed.error).toBeNull();

    const invalid = parseCliArgs(["init", "--setup-type", "weird"]);
    expect(invalid.error).toContain("cli, tool, or hybrid");
  });

  test("cli args accept init language auto-detection and explicit language lists", () => {
    const autoParsed = parseCliArgs(["init", "--languages", "auto"]);
    expect(autoParsed.command).toBe("init");
    expect(autoParsed.autoDetectLanguages).toBeTrue();
    expect(autoParsed.languages).toBeNull();
    expect(autoParsed.error).toBeNull();

    const explicitParsed = parseCliArgs(["init", "--languages", "ruby,typescript"]);
    expect(explicitParsed.autoDetectLanguages).toBeFalse();
    expect(explicitParsed.languages).toEqual(["ruby", "typescript"]);
    expect(explicitParsed.error).toBeNull();

    const invalidParsed = parseCliArgs(["init", "--languages", "ruby,fortran"]);
    expect(invalidParsed.error).toContain("Unsupported languages");
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
    const watchOwnership = getWatchOwnershipStatus(db);
    db.close();
    expect(refreshed.some((result) => result.name === "slugify")).toBeTrue();
    expect(watchOwnership.present).toBeFalse();
    expect(watchOwnership.active).toBeFalse();
  });

  test("status surfaces stale watch ownership metadata when a watch heartbeat is orphaned", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const db = await openDatabase(root);
    updateWatchOwnership(db, {
      pid: 99999,
      startedAt: "2026-04-01T10:00:00.000Z",
      lastHeartbeatAt: "2026-04-01T10:00:00.000Z",
      intervalMs: 2000,
      once: false
    });
    db.close();

    const output = await captureConsoleLog(async () => {
      await runStatus(root);
    });
    const status = JSON.parse(output) as {
      watchOwnership: {
        present: boolean;
        active: boolean;
        stale: boolean;
        pid: number | null;
        mode: "once" | "continuous" | null;
      };
    };

    expect(status.watchOwnership.present).toBeTrue();
    expect(status.watchOwnership.active).toBeFalse();
    expect(status.watchOwnership.stale).toBeTrue();
    expect(status.watchOwnership.pid).toBe(99999);
    expect(status.watchOwnership.mode).toBe("continuous");
  });

  test("opt-in impact tracking summarizes local workflow outcomes without storing raw query text", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const config = await readConfig(root);
    await writeConfig(root, {
      ...(config!),
      impactTracking: {
        enabled: true
      }
    });

    await runIndex(root, { progress: false });

    await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5);
    });
    await captureConsoleLog(async () => {
      await runShow(root, "", "greet");
    });
    await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5);
    });
    await captureConsoleLog(async () => {
      await runGraph(root, "", "greet");
    });
    await captureConsoleLog(async () => {
      await runQuery(root, "zzzzqqqqxxxxvvvv", 5);
    });
    await captureConsoleLog(async () => {
      await runQuery(root, "greet", 5);
    });

    const reportPayload = JSON.parse(await captureConsoleLog(async () => {
      await runReport(root);
    })) as {
      impactTracking: {
        enabled: boolean;
        storesRawQueryText: boolean;
        summary: {
          recordedCommands: number;
          recordedInfrastructureCommands: number;
          commandCounts: Record<string, number>;
          infrastructureCommandCounts: Record<string, number>;
          resultQualityCounts: Record<string, number>;
          transitionCounts: Record<string, number>;
          workflowSignals: {
            oneShotStrongLookups: number;
            noStrongMatchCount: number;
            graphFollowUpsAfterRetrieval: number;
          };
          estimatedImpact: {
            avoidedSearchLoops: number;
            avoidedDirectFileReads: number;
          };
          lastCommand: {
            command: string;
          } | null;
        };
      };
    };

    expect(reportPayload.impactTracking.enabled).toBeTrue();
    expect(reportPayload.impactTracking.storesRawQueryText).toBeFalse();
    expect(reportPayload.impactTracking.summary.recordedCommands).toBe(8);
    expect(reportPayload.impactTracking.summary.recordedInfrastructureCommands).toBe(0);
    expect(reportPayload.impactTracking.summary.commandCounts.index).toBe(1);
    expect(reportPayload.impactTracking.summary.commandCounts.lookup).toBe(2);
    expect(reportPayload.impactTracking.summary.infrastructureCommandCounts.watch).toBe(0);
    expect(reportPayload.impactTracking.summary.commandCounts.show).toBe(1);
    expect(reportPayload.impactTracking.summary.commandCounts.graph).toBe(1);
    expect(reportPayload.impactTracking.summary.commandCounts.query).toBe(2);
    expect(reportPayload.impactTracking.summary.commandCounts.report).toBe(1);
    expect(reportPayload.impactTracking.summary.resultQualityCounts.strong).toBeGreaterThan(0);
    expect(reportPayload.impactTracking.summary.resultQualityCounts.none).toBeGreaterThan(0);
    expect(reportPayload.impactTracking.summary.transitionCounts.lookup_to_show).toBe(1);
    expect(reportPayload.impactTracking.summary.transitionCounts.lookup_to_graph).toBe(1);
    expect(reportPayload.impactTracking.summary.transitionCounts.weak_result_retry).toBe(1);
    expect(reportPayload.impactTracking.summary.workflowSignals.oneShotStrongLookups).toBeGreaterThan(0);
    expect(reportPayload.impactTracking.summary.workflowSignals.noStrongMatchCount).toBe(1);
    expect(reportPayload.impactTracking.summary.workflowSignals.graphFollowUpsAfterRetrieval).toBe(1);
    expect(reportPayload.impactTracking.summary.estimatedImpact.avoidedSearchLoops).toBeGreaterThan(0);
    expect(reportPayload.impactTracking.summary.estimatedImpact.avoidedDirectFileReads).toBeGreaterThan(0);
    expect(reportPayload.impactTracking.summary.lastCommand?.command).toBe("report");

    const statusPayload = JSON.parse(await captureConsoleLog(async () => {
      await runStatus(root);
    })) as {
      impactTracking: {
        enabled: boolean;
        storesRawQueryText: boolean;
        summary: {
          commandCounts: Record<string, number>;
        } | null;
      };
    };

    expect(statusPayload.impactTracking.enabled).toBeTrue();
    expect(statusPayload.impactTracking.storesRawQueryText).toBeFalse();
    expect(statusPayload.impactTracking.summary?.commandCounts.status).toBe(1);
  });

  test("impact tracking transitions survive interleaved non-flow commands", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    const config = await readConfig(root);
    await writeConfig(root, {
      ...(config!),
      impactTracking: {
        enabled: true
      }
    });

    await runIndex(root, { progress: false });

    await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5);
    });
    await captureConsoleLog(async () => {
      await runStatus(root);
    });
    await captureConsoleLog(async () => {
      await runShow(root, "", "greet", { full: true });
    });
    await captureConsoleLog(async () => {
      await runWatch(root, { once: true });
    });
    await captureConsoleLog(async () => {
      await runLookup(root, "greet", 5);
    });
    await captureConsoleLog(async () => {
      await runStatus(root);
    });
    await captureConsoleLog(async () => {
      await runGraph(root, "", "greet", { full: true });
    });

    const reportPayload = JSON.parse(await captureConsoleLog(async () => {
      await runReport(root);
    })) as {
      impactTracking: {
        summary: {
          recordedCommands: number;
          recordedInfrastructureCommands: number;
          commandCounts: Record<string, number>;
          infrastructureCommandCounts: Record<string, number>;
          transitionCounts: Record<string, number>;
        };
      };
    };

    expect(reportPayload.impactTracking.summary.recordedInfrastructureCommands).toBe(1);
    expect(reportPayload.impactTracking.summary.infrastructureCommandCounts.watch).toBe(1);
    expect(reportPayload.impactTracking.summary.commandCounts.watch).toBe(0);
    expect(reportPayload.impactTracking.summary.recordedCommands).toBe(8);
    expect(reportPayload.impactTracking.summary.commandCounts.index).toBe(1);
    expect(reportPayload.impactTracking.summary.transitionCounts.lookup_to_show).toBe(1);
    expect(reportPayload.impactTracking.summary.transitionCounts.lookup_to_full_show).toBe(1);
    expect(reportPayload.impactTracking.summary.transitionCounts.lookup_to_graph).toBe(1);
    expect(reportPayload.impactTracking.summary.transitionCounts.lookup_to_full_graph).toBe(1);
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
          confidence: string;
          retrievalTrustLevel: string;
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
      expect(["exact", "strong"]).toContain(output.results[0]?.confidence ?? "");
      expect(output.results[0]?.retrievalTrustLevel).toBe("high");
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

  test("result quality upgrades semantically confirmed hybrid top hits without loosening weak results", () => {
    const semanticallyConfirmed = summarizeRetrievalQuality([
      {
        id: 1,
        path: "app/workers/resend_welcome_email_worker.rb",
        file: { path: "app/workers/resend_welcome_email_worker.rb", language: "ruby" },
        location: { path: "app/workers/resend_welcome_email_worker.rb", startLine: 1, startColumn: 1, endLine: 12, endColumn: 1 },
        language: "ruby",
        kind: "class",
        name: "ResendWelcomeEmailWorker",
        signature: "class ResendWelcomeEmailWorker",
        doc: null,
        distance: 0.2,
        score: 1,
        scoreMarginFromTop: 0.22,
        confidence: "related",
        matchReason: "semantic_similarity",
        extraction: "parsed",
        trustLevel: "high",
        retrievalTrustLevel: "high",
        semanticSimilarity: 0.725,
        retrievalChannels: ["lexical", "semantic"],
        hybridContribution: "semantic_assisted",
        graphSignals: [],
        fallback: false,
        startLine: 1,
        startColumn: 1,
        endLine: 12,
        endColumn: 1,
        snippet: "class ResendWelcomeEmailWorker"
      },
      {
        id: 2,
        path: "docs/email.md",
        file: { path: "docs/email.md", language: "markdown" },
        location: { path: "docs/email.md", startLine: 1, startColumn: 1, endLine: 2, endColumn: 1 },
        language: "markdown",
        kind: "heading",
        name: "Email notes",
        signature: null,
        doc: null,
        distance: 0.45,
        score: 0.78,
        scoreMarginFromTop: 0,
        confidence: "related",
        matchReason: "token_overlap",
        extraction: "parsed",
        trustLevel: "high",
        retrievalTrustLevel: "medium",
        semanticSimilarity: 0.42,
        retrievalChannels: ["lexical"],
        hybridContribution: "lexical_only",
        graphSignals: [],
        fallback: false,
        startLine: 1,
        startColumn: 1,
        endLine: 2,
        endColumn: 1,
        snippet: "Email notes"
      }
    ]);

    expect(semanticallyConfirmed.level).toBe("strong");
    expect(semanticallyConfirmed.reason).toBe("top_result_semantically_confirmed");
    expect(semanticallyConfirmed.noStrongMatch).toBeFalse();

    const stillWeak = summarizeRetrievalQuality([
      {
        id: 3,
        path: "docs/random.md",
        file: { path: "docs/random.md", language: "markdown" },
        location: { path: "docs/random.md", startLine: 1, startColumn: 1, endLine: 2, endColumn: 1 },
        language: "markdown",
        kind: "heading",
        name: "Random note",
        signature: null,
        doc: null,
        distance: 0.8,
        score: 1,
        scoreMarginFromTop: 0.03,
        confidence: "related",
        matchReason: "token_overlap",
        extraction: "parsed",
        trustLevel: "high",
        retrievalTrustLevel: "medium",
        semanticSimilarity: null,
        retrievalChannels: ["lexical"],
        hybridContribution: "lexical_only",
        graphSignals: [],
        fallback: false,
        startLine: 1,
        startColumn: 1,
        endLine: 2,
        endColumn: 1,
        snippet: "Random note"
      }
    ]);

    expect(stillWeak.level).toBe("moderate");
    expect(stillWeak.reason).toBe("related_but_actionable");
    expect(stillWeak.noStrongMatch).toBeTrue();
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
          file: { path: string; language: string };
          location: { path: string; startLine: number };
          confidence: string;
          retrievalTrustLevel: string;
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
      expect(normalizeRepoPath(output.results[0]?.file.path)).toBe("src/memory_store.py");
      expect(normalizeRepoPath(output.results[0]?.location.path)).toBe("src/memory_store.py");
      expect(["exact", "strong"]).toContain(output.results[0]?.confidence ?? "");
      expect(output.results[0]?.retrievalTrustLevel).toBe("high");
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

    const excludePathParsed = parseCliArgs([
      "query",
      "greet",
      "--exclude-path",
      "_deprecated",
      "--exclude-path",
      "legacy"
    ]);
    expect(excludePathParsed.excludePaths).toEqual(["_deprecated", "legacy"]);

    const includePathParsed = parseCliArgs([
      "lookup",
      "greet",
      "--path",
      "app/services/greeting.rb",
      "--path",
      "lib/legacy"
    ]);
    expect(includePathParsed.includePaths).toEqual(["app/services/greeting.rb", "lib/legacy"]);

    const conflictingQueryParsed = parseCliArgs(["query", "greet", "--code-only", "--docs-only"]);
    expect(conflictingQueryParsed.error).toContain("--code-only or --docs-only");

    const lookupParsed = parseCliArgs(["lookup", "greet", "--top", "3", "--code-only", "--full"]);
    expect(lookupParsed.command).toBe("lookup");
    expect(lookupParsed.limit).toBe(3);
    expect(lookupParsed.codeOnly).toBeTrue();
    expect(lookupParsed.showFull).toBeTrue();

    const indexParsed = parseCliArgs(["index", "--rebuild"]);
    expect(indexParsed.command).toBe("index");
    expect(indexParsed.rebuildIndex).toBeTrue();

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

    const positionalShowParsed = parseCliArgs(["show", "greet"]);
    expect(positionalShowParsed.showName).toBe("greet");
    expect(positionalShowParsed.positionals).toEqual([]);
    expect(positionalShowParsed.error).toBeNull();

    const numericShowParsed = parseCliArgs(["show", "42"]);
    expect(numericShowParsed.showName).toBeNull();
    expect(numericShowParsed.positionals).toEqual(["42"]);
    expect(numericShowParsed.error).toBeNull();

    const graphParsed = parseCliArgs(["graph", "--name", "slugify", "--compact"]);
    expect(graphParsed.command).toBe("graph");
    expect(graphParsed.showName).toBe("slugify");
    expect(graphParsed.compactOutput).toBeTrue();
    expect(graphParsed.error).toBeNull();
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
    expect(output).toContain("Exploration flow");
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
    expect(output).toContain("Best-match flow");
  });

  test("graph help is handled as CLI help instead of graph text", async () => {
    const parsed = parseCliArgs(["graph", "--help"]);
    expect(parsed.command).toBe("graph");
    expect(parsed.helpRequested).toBeTrue();
    expect(parsed.positionals).toEqual([]);
    expect(parsed.error).toBeNull();

    const output = await captureConsoleLog(async () => {
      await runCli(["graph", "--help"]);
    });
    expect(output).toContain("symballist graph --name <symbol>");
    expect(output).toContain("Traversal flow");
  });

  test("show accepts a positional symbol name as shorthand for --name", async () => {
    const root = await createFixtureRepo();
    await runInit(root);
    await runIndex(root, { progress: false });

    const shorthandPayload = JSON.parse(await captureConsoleLog(async () => {
      await runCli(["show", "greet", "--root", root]);
    })) as {
      symbol?: {
        name: string;
        path: string;
      };
    };

    const explicitPayload = JSON.parse(await captureConsoleLog(async () => {
      await runCli(["show", "--name", "greet", "--root", root]);
    })) as {
      symbol?: {
        name: string;
        path: string;
      };
    };

    expect(shorthandPayload.symbol?.name).toBe("greet");
    expect(normalizeRepoPath(shorthandPayload.symbol?.path)).toBe("app.py");
    expect(explicitPayload.symbol?.name).toBe("greet");
    expect(normalizeRepoPath(explicitPayload.symbol?.path)).toBe("app.py");
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
