import { useCallback, useEffect, useState } from "react";
import { fetchSyncRaces, pushAllLocalRaces } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import {
  addPendingSyncRace,
  clearPendingSyncRaces,
  getPendingSyncRaces,
  hasPendingSyncRaces,
  removePendingSyncRace,
} from "@shared/sync/pendingSync";
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
  const [hasPending, setHasPending] = useState(() =>
    userId ? hasPendingSyncRaces(userId) : false,
  );

  const refreshCloudStats = useCallback(async () => {
    if (!accessToken) {
      setCloudRaceCount(null);
      return;
    }
    try {
      const races = await fetchSyncRaces(accessToken);
      setCloudRaceCount(races.length);
    } catch (err) {
      setCloudRaceCount(null);
      setSyncError(err instanceof Error ? err.message : "Could not load cloud races.");
    }
  }, [accessToken]);

  useEffect(() => {
    if (userId) {
      setLastSyncAtState(getLastSyncAt(userId));
      setHasPending(hasPendingSyncRaces(userId));
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
      const result = await pushAllLocalRaces(accessToken);
      if (result.failed.length > 0) {
        for (const entry of result.failed) {
          addPendingSyncRace(userId, entry.race_id);
        }
        setHasPending(true);
        setSyncError(
          `${result.failed.length} race${result.failed.length === 1 ? "" : "s"} waiting to sync.`,
        );
      } else {
        clearPendingSyncRaces(userId);
        setHasPending(false);
      }
      if (result.uploaded.length > 0) {
        for (const raceId of result.uploaded) {
          removePendingSyncRace(userId, raceId);
        }
        setHasPending(hasPendingSyncRaces(userId));
      }
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
    hasPending,
    pendingSyncRaces: userId ? getPendingSyncRaces(userId) : new Set<string>(),
    syncNow,
    refreshCloudStats,
  };
}

export function recordSyncSuccess(userId: string): void {
  const now = new Date().toISOString();
  setLastSyncAt(userId, now);
  clearPendingSyncRaces(userId);
}

export function recordSyncFailure(userId: string, raceIds: string[]): void {
  for (const raceId of raceIds) {
    addPendingSyncRace(userId, raceId);
  }
}
