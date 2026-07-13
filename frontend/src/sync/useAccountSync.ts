import { useCallback, useEffect, useState } from "react";
import { fetchSyncRaces, pushAllLocalRaces } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import {
  formatRelativeTime,
  getLastSyncAt,
  setLastSyncAt,
  setSyncInProgress,
} from "@shared/sync/syncMeta";

export function useAccountSync() {
  const { accessToken, user, configured } = useAuth();
  const userId = user?.id ?? "";
  const [syncing, setSyncing] = useState(false);
  const [cloudRaceCount, setCloudRaceCount] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(() =>
    userId ? getLastSyncAt(userId) : null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);

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
    if (accessToken) {
      void refreshCloudStats();
    }
  }, [accessToken, refreshCloudStats]);

  const syncNow = useCallback(async () => {
    if (!accessToken || !userId) {
      return;
    }
    setSyncError(null);
    setSyncing(true);
    setSyncInProgress(userId, true);
    try {
      await pushAllLocalRaces(accessToken);
      const now = new Date().toISOString();
      setLastSyncAt(userId, now);
      setLastSyncAtState(now);
      await refreshCloudStats();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed.");
      throw err;
    } finally {
      setSyncing(false);
      setSyncInProgress(userId, false);
    }
  }, [accessToken, refreshCloudStats, userId]);

  return {
    configured,
    syncing,
    cloudRaceCount,
    lastSyncAt,
    lastSyncLabel: formatRelativeTime(lastSyncAt),
    syncError,
    syncNow,
    refreshCloudStats,
  };
}

export function recordSyncSuccess(userId: string): void {
  const now = new Date().toISOString();
  setLastSyncAt(userId, now);
}
