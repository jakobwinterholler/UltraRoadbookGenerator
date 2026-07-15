import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { normalizeSyncListError } from "@shared/api/supabaseErrors";
import { fetchSyncRaces } from "@shared/api/sync";
import type { SyncRaceSummary } from "@shared/types/sync";
import { needsCompanionDownload } from "@shared/sync/raceVersion";
import { useAuth } from "@shared/auth/AuthProvider";
import { logSyncDebug } from "@shared/sync/syncDebugLog";
import {
  hasValidCompanionBundle,
  invalidateStaleBundle,
  loadRaceList,
  saveRaceList,
  type StoredRaceListItem,
} from "../db";

async function resolveOfflineReady(
  race: SyncRaceSummary,
  existing: StoredRaceListItem | undefined,
): Promise<{
  downloadedRevision: number | null;
  downloadedChecksum: string | null;
  offlineReady: boolean;
}> {
  const downloadedRevision = existing?.downloadedRevision ?? null;
  const downloadedChecksum = existing?.downloadedChecksum ?? null;

  if (!existing?.offlineReady || downloadedRevision === null) {
    return { downloadedRevision, downloadedChecksum, offlineReady: false };
  }

  const bundleExists = await hasValidCompanionBundle(race.id);
  if (!bundleExists) {
    logSyncDebug("stale-cache", `${race.name} — bundle missing or invalid in IndexedDB`, {
      raceId: race.id,
      downloadedRevision,
      downloadedChecksum,
    });
    await invalidateStaleBundle(race.id);
    return { downloadedRevision: null, downloadedChecksum: null, offlineReady: false };
  }

  const needsUpdate = needsCompanionDownload(
    race,
    downloadedRevision,
    true,
    downloadedChecksum,
  );
  if (needsUpdate) {
    logSyncDebug("stale-cache", `${race.name} — cloud revision/checksum newer than local`, {
      raceId: race.id,
      cloudRevision: race.companion_revision,
      localRevision: downloadedRevision,
      cloudChecksum: race.bundle_checksum,
      localChecksum: downloadedChecksum,
    });
    await invalidateStaleBundle(race.id);
    return { downloadedRevision: null, downloadedChecksum: null, offlineReady: false };
  }

  if (
    race.bundle_checksum &&
    downloadedChecksum &&
    race.bundle_checksum !== downloadedChecksum
  ) {
    logSyncDebug("checksum-mismatch", `${race.name} — checksum drift detected`, {
      raceId: race.id,
      cloud: race.bundle_checksum,
      local: downloadedChecksum,
    });
    await invalidateStaleBundle(race.id);
    return { downloadedRevision: null, downloadedChecksum: null, offlineReady: false };
  }

  return { downloadedRevision, downloadedChecksum, offlineReady: true };
}

async function mergeRaceLists(
  cloud: SyncRaceSummary[],
  local: StoredRaceListItem[],
): Promise<StoredRaceListItem[]> {
  const localById = new Map(local.map((race) => [race.id, race]));
  const cloudIds = new Set(cloud.map((race) => race.id));
  const merged: StoredRaceListItem[] = [];

  for (const race of cloud) {
    const existing = localById.get(race.id);
    const status = await resolveOfflineReady(race, existing);
    merged.push({
      ...race,
      ...status,
      source: existing?.source === "local-import" ? "local-import" : "cloud",
      lastOpenedAt: existing?.lastOpenedAt ?? null,
    });
  }

  for (const race of local) {
    if (cloudIds.has(race.id)) {
      continue;
    }
    if (!race.offlineReady && race.source !== "local-import") {
      continue;
    }
    merged.push({
      ...race,
      source: race.source ?? "local-import",
    });
  }

  return merged.sort((left, right) =>
    (right.updated_at ?? "").localeCompare(left.updated_at ?? ""),
  );
}

interface CloudRaceListContextValue {
  races: StoredRaceListItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  onlineConfigured: boolean;
}

const CloudRaceListContext = createContext<CloudRaceListContextValue | null>(null);

export function CloudRaceListProvider({ children }: { children: ReactNode }) {
  const { accessToken, configured } = useAuth();
  const [races, setRaces] = useState<StoredRaceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const local = await loadRaceList();
      if (!accessToken) {
        setRaces(local);
        return;
      }
      const cloud = await fetchSyncRaces(accessToken);
      logSyncDebug("race-list", `Cloud race list refreshed (${cloud.length} races)`, cloud);
      const merged = await mergeRaceLists(cloud, local);
      await saveRaceList(merged);
      setRaces(merged);
      logSyncDebug("race-list", `IndexedDB race list saved (${merged.length} races)`);
    } catch (err) {
      const local = await loadRaceList();
      setRaces(local);
      const message = err instanceof Error ? err.message : "Failed to load races.";
      setError(normalizeSyncListError(message));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      setError("Cloud sync is not configured.");
      return;
    }
    void refresh();
  }, [configured, refresh]);

  const value = useMemo(
    () => ({
      races,
      loading,
      error,
      refresh,
      onlineConfigured: configured,
    }),
    [configured, error, loading, races, refresh],
  );

  return (
    <CloudRaceListContext.Provider value={value}>{children}</CloudRaceListContext.Provider>
  );
}

export function useCloudRaceList(): CloudRaceListContextValue {
  const context = useContext(CloudRaceListContext);
  if (!context) {
    throw new Error("useCloudRaceList must be used within CloudRaceListProvider.");
  }
  return context;
}
