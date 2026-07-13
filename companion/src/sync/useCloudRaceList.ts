import { useCallback, useEffect, useState } from "react";
import { fetchSyncRaces } from "@shared/api/sync";
import type { SyncRaceSummary } from "@shared/types/sync";
import { useAuth } from "@shared/auth/AuthProvider";
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

export function useCloudRaceList() {
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
      const merged = mergeRaceLists(cloud, local);
      await saveRaceList(merged);
      setRaces(merged);
    } catch (err) {
      const local = await loadRaceList();
      setRaces(local);
      setError(err instanceof Error ? err.message : "Failed to load races.");
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

  return { races, loading, error, refresh, onlineConfigured: configured };
}
