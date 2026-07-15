export interface SyncDebugEntry {
  at: string;
  stage: string;
  detail: string;
  data?: unknown;
}

const MAX_ENTRIES = 80;
let entries: SyncDebugEntry[] = [];

export function logSyncDebug(stage: string, detail: string, data?: unknown): void {
  const entry: SyncDebugEntry = {
    at: new Date().toISOString(),
    stage,
    detail,
    data,
  };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), entry];
  if (typeof console !== "undefined" && console.info) {
    console.info(`[sync] ${stage}: ${detail}`, data ?? "");
  }
}

export function getSyncDebugLog(): SyncDebugEntry[] {
  return [...entries];
}

export function clearSyncDebugLog(): void {
  entries = [];
}
