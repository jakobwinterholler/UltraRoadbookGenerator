import { useCallback, useEffect, useState } from "react";
import { fetchSyncRaces } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import {
  formatRelativeTime,
  getLastSyncAt,
  setLastSyncAt,
} from "@shared/sync/syncMeta";
import { useCloudRaceList } from "../sync/useCloudRaceList";
import { loadRaceList } from "../db";

export function useCompanionSync() {
  const { user, accessToken } = useAuth();
  const userId = user?.id ?? "";
  const { refresh, loading } = useCloudRaceList();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(() =>
    userId ? getLastSyncAt(userId) : null,
  );
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [cloudRaceCount, setCloudRaceCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshLocalStats = useCallback(async () => {
    const races = await loadRaceList();
    setDownloadedCount(races.filter((race) => race.offlineReady).length);
  }, []);

  const refreshCloudStats = useCallback(async () => {
    if (!accessToken) {
      setCloudRaceCount(null);
      return;
    }
    try {
      const races = await fetchSyncRaces(accessToken);
      setCloudRaceCount(races.length);
    } catch {
      setCloudRaceCount(null);
    }
  }, [accessToken]);

  useEffect(() => {
    if (userId) {
      setLastSyncAtState(getLastSyncAt(userId));
    }
  }, [userId]);

  useEffect(() => {
    void refreshLocalStats();
    void refreshCloudStats();
  }, [refreshLocalStats, refreshCloudStats, loading]);

  const syncNow = useCallback(async () => {
    if (!userId) {
      return;
    }
    setSyncError(null);
    setSyncing(true);
    try {
      await refresh();
      const now = new Date().toISOString();
      setLastSyncAt(userId, now);
      setLastSyncAtState(now);
      await refreshLocalStats();
      await refreshCloudStats();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed.");
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [refresh, refreshCloudStats, refreshLocalStats, userId]);

  return {
    syncing: syncing || loading,
    lastSyncAt,
    lastSyncLabel: formatRelativeTime(lastSyncAt),
    downloadedCount,
    cloudRaceCount,
    syncError,
    syncNow,
    refreshLocalStats,
  };
}
