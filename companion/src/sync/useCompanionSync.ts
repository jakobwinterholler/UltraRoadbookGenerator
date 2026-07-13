import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import {
  formatRelativeTime,
  getLastSyncAt,
  setLastSyncAt,
} from "@shared/sync/syncMeta";
import { useCloudRaceList } from "../sync/useCloudRaceList";
import { loadRaceList } from "../db";

export function useCompanionSync() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { refresh, loading } = useCloudRaceList();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(() =>
    userId ? getLastSyncAt(userId) : null,
  );
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshLocalStats = useCallback(async () => {
    const races = await loadRaceList();
    setDownloadedCount(races.filter((race) => race.offlineReady).length);
  }, []);

  useEffect(() => {
    if (userId) {
      setLastSyncAtState(getLastSyncAt(userId));
    }
  }, [userId]);

  useEffect(() => {
    void refreshLocalStats();
  }, [refreshLocalStats, loading]);

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
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed.");
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [refresh, refreshLocalStats, userId]);

  return {
    syncing: syncing || loading,
    lastSyncAt,
    lastSyncLabel: formatRelativeTime(lastSyncAt),
    downloadedCount,
    syncError,
    syncNow,
    refreshLocalStats,
  };
}
