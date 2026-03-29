import { openDatabase, replaceFileIndex } from "../db.ts";
import { fileMetadata, listSourceFiles, readText } from "../fs.ts";
import { extractSymbols } from "../indexer/index.ts";

export async function runIndex(root: string): Promise<void> {
  const db = await openDatabase(root);
  const files = await listSourceFiles(root);

  let fileCount = 0;
  let symbolCount = 0;

  for (const file of files) {
    const source = await readText(file.absolutePath);
    const metadata = await fileMetadata(file.absolutePath);
    const symbols = extractSymbols(file.relativePath, file.language, source);
    symbolCount += replaceFileIndex(
      db,
      {
        path: file.relativePath,
        language: file.language,
        size: metadata.size,
        mtimeMs: metadata.mtimeMs
      },
      symbols
    );
    fileCount += 1;
  }

  db.close();
  console.log(JSON.stringify({ indexedFiles: fileCount, indexedSymbols: symbolCount }, null, 2));
}
