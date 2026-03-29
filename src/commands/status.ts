import { APP_DIR, CONFIG_FILE, DB_FILE, SUPPORTED_EXTENSIONS, appPath } from "../config.ts";
import { CURRENT_SCHEMA_VERSION, getStatusSummary, openDatabase } from "../db.ts";
import { exists, readConfig } from "../fs.ts";

function defaultLanguages(): string[] {
  return [...new Set(SUPPORTED_EXTENSIONS.values())].sort();
}

export async function runStatus(root: string): Promise<void> {
  const configPath = appPath(root, CONFIG_FILE);
  const dbPath = appPath(root, DB_FILE);
  const config = await readConfig(root);
  const dbExists = await exists(dbPath);

  let indexedFiles = 0;
  let indexedSymbols = 0;
  let fallbackSymbols = 0;
  let indexedSchemaVersion: number | null = null;
  let languages = config?.languages ?? defaultLanguages();

  if (dbExists) {
    const db = await openDatabase(root);
    const summary = getStatusSummary(db);
    db.close();
    indexedFiles = summary.indexedFiles;
    indexedSymbols = summary.indexedSymbols;
    fallbackSymbols = summary.fallbackSymbols;
    indexedSchemaVersion = summary.schemaVersion;
    if (summary.languages.length > 0) {
      languages = summary.languages;
    }
  }

  console.log(JSON.stringify({
    root,
    appDir: appPath(root),
    configPath,
    dbPath,
    initialized: config !== null,
    appDirExists: await exists(appPath(root)),
    configExists: config !== null,
    dbExists,
    supportedLanguages: languages,
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    indexedSchemaVersion,
    indexedFiles,
    indexedSymbols,
    fallbackSymbols
  }, null, 2));
}
