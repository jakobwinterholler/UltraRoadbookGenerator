import { useCallback, useEffect, useState } from "react";
import { fetchSyncRaces, pushRaceNow } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import type { SyncPushRaceResult } from "@shared/types/sync";
import {
  addPendingSyncRace,
  clearPendingSyncRaces,
  getPendingSyncRaces,
  hasPendingSyncRaces,
  removePendingSyncRace,
} from "@shared/sync/pendingSync";
import { needsDesktopUpload } from "@shared/sync/raceVersion";
import {
  formatRelativeTime,
  getLastSyncAt,
  setLastSyncAt,
  setSyncInProgress,
} from "@shared/sync/syncMeta";
import { fetchRaces } from "../races/api";

export interface RaceSyncResult {
  raceId: string;
  name: string;
  status: "success" | "failed" | "skipped";
  error?: string;
  companionRevision?: number;
}

export function useAccountSync() {
  const { accessToken, user, configured } = useAuth();
  const userId = user?.id ?? "";
  const [syncing, setSyncing] = useState(false);
  const [cloudRaceCount, setCloudRaceCount] = useState<number | null>(null);
  const [maxCloudRevision, setMaxCloudRevision] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(() =>
    userId ? getLastSyncAt(userId) : null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [hasPending, setHasPending] = useState(() =>
    userId ? hasPendingSyncRaces(userId) : false,
  );
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    raceName: string;
  } | null>(null);
  const [raceResults, setRaceResults] = useState<RaceSyncResult[]>([]);
  const [syncingRaceId, setSyncingRaceId] = useState<string | null>(null);

  const refreshCloudStats = useCallback(async () => {
    if (!accessToken) {
      setCloudRaceCount(null);
      setMaxCloudRevision(null);
      return;
    }
    try {
      const races = await fetchSyncRaces(accessToken);
      setCloudRaceCount(races.length);
      const revisions = races.map((race) => race.companion_revision);
      setMaxCloudRevision(revisions.length > 0 ? Math.max(...revisions) : 0);
    } catch (err) {
      setCloudRaceCount(null);
      setMaxCloudRevision(null);
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

  const syncToCompanion = useCallback(async () => {
    if (!accessToken || !userId) {
      throw new Error("Sign in required to sync races.");
    }
    setSyncError(null);
    setSyncMessage(null);
    setRaceResults([]);
    setSyncing(true);
    setSyncInProgress(userId, true);

    try {
      const [localRaces, cloudRaces] = await Promise.all([
        fetchRaces(),
        fetchSyncRaces(accessToken),
      ]);
      const cloudById = new Map(cloudRaces.map((race) => [race.id, race]));
      const pending = getPendingSyncRaces(userId);

      const toUpload = localRaces.filter((race) =>
        needsDesktopUpload(race, cloudById.get(race.id), pending),
      );

      if (toUpload.length === 0) {
        setSyncMessage("All races are up to date in the cloud.");
        const now = new Date().toISOString();
        setLastSyncAt(userId, now);
        setLastSyncAtState(now);
        await refreshCloudStats();
        return;
      }

      const results: RaceSyncResult[] = [];
      for (let index = 0; index < toUpload.length; index += 1) {
        const race = toUpload[index];
        setSyncingRaceId(race.id);
        setSyncProgress({
          current: index + 1,
          total: toUpload.length,
          raceName: race.name,
        });
        try {
          const pushed: SyncPushRaceResult = await pushRaceNow(accessToken, race.id);
          removePendingSyncRace(userId, race.id);
          results.push({
            raceId: race.id,
            name: race.name,
            status: "success",
            companionRevision: pushed.companion_revision,
          });
        } catch (err) {
          addPendingSyncRace(userId, race.id);
          const message = err instanceof Error ? err.message : "Upload failed.";
          results.push({
            raceId: race.id,
            name: race.name,
            status: "failed",
            error: message,
          });
        }
      }

      setRaceResults(results);
      const failed = results.filter((entry) => entry.status === "failed");
      const succeeded = results.filter((entry) => entry.status === "success");
      setHasPending(hasPendingSyncRaces(userId));

      if (failed.length > 0 && succeeded.length === 0) {
        setSyncError(
          `Failed to upload ${failed.length} race${failed.length === 1 ? "" : "s"}. ${failed[0]?.error ?? ""}`.trim(),
        );
      } else if (failed.length > 0) {
        setSyncMessage(
          `Uploaded ${succeeded.length}, ${failed.length} failed. Check details below.`,
        );
        setSyncError(
          failed.map((entry) => `${entry.name}: ${entry.error}`).join(" · "),
        );
      } else {
        clearPendingSyncRaces(userId);
        setHasPending(false);
        setSyncMessage(
          `Uploaded ${succeeded.length} race${succeeded.length === 1 ? "" : "s"} to Companion.`,
        );
      }

      const now = new Date().toISOString();
      setLastSyncAt(userId, now);
      setLastSyncAtState(now);
      await refreshCloudStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed.";
      setSyncError(message);
      throw err;
    } finally {
      setSyncing(false);
      setSyncingRaceId(null);
      setSyncProgress(null);
      setSyncInProgress(userId, false);
    }
  }, [accessToken, refreshCloudStats, userId]);

  return {
    configured,
    syncing,
    cloudRaceCount,
    maxCloudRevision,
    lastSyncAt,
    lastSyncLabel: formatRelativeTime(lastSyncAt),
    syncError,
    syncMessage,
    hasPending,
    pendingSyncRaces: userId ? getPendingSyncRaces(userId) : new Set<string>(),
    syncProgress,
    raceResults,
    syncingRaceId,
    syncToCompanion,
    syncNow: syncToCompanion,
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
