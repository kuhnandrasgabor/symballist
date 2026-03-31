import { getImpactTrackingSummary, openDatabase, recordImpactTrackingEvent } from "../db.ts";
import { readConfig } from "../fs.ts";

export async function runReport(root: string): Promise<void> {
  const config = await readConfig(root);
  const db = await openDatabase(root);

  let summary = getImpactTrackingSummary(db);
  const payload = {
    root,
    impactTracking: {
      enabled: Boolean(config?.impactTracking?.enabled),
      storesRawQueryText: false,
      storage: "repo_local_metadata",
      summary,
      methodology: {
        commandCounts: "aggregate counts of intentional Symballist command families only; background watch refreshes are tracked separately as infrastructure traffic",
        transitions: "short-window follow-up chains such as lookup->show, query->graph, and weak-result retries",
        resultQuality: "derived from existing strong/moderate/weak/none retrieval outcomes rather than raw query capture",
        savings: "conservative estimates of avoided search loops and direct file reads based on successful retrieval and symbol inspection flows"
      }
    }
  };

  if (config?.impactTracking?.enabled) {
    summary = recordImpactTrackingEvent(db, {
      command: "report",
      timestamp: new Date().toISOString(),
      payloadChars: JSON.stringify(payload).length,
      compact: false
    });
    payload.impactTracking.summary = summary;
  }

  db.close();
  console.log(JSON.stringify(payload, null, 2));
}
