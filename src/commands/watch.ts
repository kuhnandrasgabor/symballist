import { runIndex, type IndexStats } from "./index.ts";
import { getIndexCompatibility, getIndexedFiles, getIndexedScopeSignature, openDatabase, recordImpactTrackingEvent } from "../db.ts";
import { detectIndexFreshness, type IndexFreshness } from "../freshness.ts";
import { readConfig } from "../fs.ts";

const DEFAULT_WATCH_INTERVAL_MS = 2000;

export type WatchEvent = {
  event: "indexed" | "idle";
  reason: "initial_index" | "stale_index" | "already_fresh";
  cycle: number;
  intervalMs: number;
  indexedFileCountBefore: number;
  indexFreshnessBefore: IndexFreshness;
  indexFreshnessAfter: IndexFreshness;
  stats: IndexStats | null;
  timestamp: string;
};

export type RunWatchOptions = {
  intervalMs?: number;
  once?: boolean;
  maxCycles?: number;
  progress?: boolean;
};

async function inspectWatchState(root: string): Promise<{
  indexedFileCount: number;
  freshness: IndexFreshness;
  requiresRebuild: boolean;
}> {
  const db = await openDatabase(root);
  const indexedFiles = getIndexedFiles(db);
  const indexedScopeSignature = getIndexedScopeSignature(db);
  const indexCompatibility = getIndexCompatibility(db);
  db.close();

  return {
    indexedFileCount: indexedFiles.length,
    freshness: await detectIndexFreshness(root, indexedFiles, {
      indexedScopeSignature
    }),
    requiresRebuild: indexCompatibility.requiresRebuild
  };
}

function normalizeCycleLimit(options: RunWatchOptions): number {
  if (options.once === true) {
    return 1;
  }
  if (options.maxCycles === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isFinite(options.maxCycles) || options.maxCycles <= 0) {
    throw new Error("Watch cycle limit must be a positive number.");
  }
  return Math.floor(options.maxCycles);
}

export async function runWatch(root: string, options: RunWatchOptions = {}): Promise<WatchEvent[]> {
  const intervalMs = options.intervalMs ?? DEFAULT_WATCH_INTERVAL_MS;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("Watch interval must be a positive number of milliseconds.");
  }

  const cycleLimit = normalizeCycleLimit(options);
  const progress = options.progress ?? false;
  const config = await readConfig(root);
  const events: WatchEvent[] = [];

  for (let cycle = 1; cycle <= cycleLimit; cycle += 1) {
    const before = await inspectWatchState(root);
    const shouldIndex = before.indexedFileCount === 0 || before.freshness.stale || before.requiresRebuild;

    let stats: IndexStats | null = null;
    let reason: WatchEvent["reason"] = "already_fresh";
    if (shouldIndex) {
      reason = before.indexedFileCount === 0 ? "initial_index" : before.requiresRebuild ? "stale_index" : "stale_index";
      stats = await runIndex(root, {
        progress,
        emitStats: false,
        rebuild: before.requiresRebuild
      });
    }

    const after = shouldIndex ? await inspectWatchState(root) : before;
    const event: WatchEvent = {
      event: shouldIndex ? "indexed" : "idle",
      reason,
      cycle,
      intervalMs,
      indexedFileCountBefore: before.indexedFileCount,
      indexFreshnessBefore: before.freshness,
      indexFreshnessAfter: after.freshness,
      stats,
      timestamp: new Date().toISOString()
    };

    if (config?.impactTracking?.enabled) {
      const db = await openDatabase(root);
      recordImpactTrackingEvent(db, {
        command: "watch",
        timestamp: event.timestamp,
        payloadChars: JSON.stringify(event).length,
        compact: false,
        staleIndex: event.indexFreshnessBefore.stale
      });
      db.close();
    }

    console.log(JSON.stringify(event, null, 2));
    events.push(event);

    if (cycle === cycleLimit) {
      break;
    }

    await Bun.sleep(intervalMs);
  }

  return events;
}
