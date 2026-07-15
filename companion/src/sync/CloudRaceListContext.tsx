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
import { useAuth } from "@shared/auth/AuthProvider";
import { logSyncDebug } from "@shared/sync/syncDebugLog";
import { loadRaceList, saveRaceList, type StoredRaceListItem } from "../db";

function mergeRaceLists(
  cloud: SyncRaceSummary[],
  local: StoredRaceListItem[],
): StoredRaceListItem[] {
  const localById = new Map(local.map((race) => [race.id, race]));
  return cloud.map((race) => {
    const existing = localById.get(race.id);
    const downloadedRevision = existing?.downloadedRevision ?? null;
    const offlineReady = Boolean(
      existing?.offlineReady &&
        downloadedRevision !== null &&
        downloadedRevision >= race.companion_revision,
    );
    return {
      ...race,
      downloadedRevision,
      offlineReady,
    };
  });
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
      const merged = mergeRaceLists(cloud, local);
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
