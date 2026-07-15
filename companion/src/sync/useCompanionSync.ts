import { useCallback, useEffect, useState } from "react";
import { fetchCompanionBundle, fetchSyncRaces } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import {
  formatRelativeTime,
  getLastCheckAt,
  getLastSyncAt,
  setLastCheckAt,
  setLastSyncAt,
} from "@shared/sync/syncMeta";
import {
  formatUpdateSummary,
  needsCompanionDownload,
  raceVersionFields,
} from "@shared/sync/raceVersion";
import { useCloudRaceList } from "../sync/useCloudRaceList";
import { loadRaceList, saveCompanionBundle } from "../db";

export interface CompanionUpdateResult {
  raceId: string;
  name: string;
  status: "downloaded" | "failed" | "skipped";
  error?: string;
  kind?: "new" | "updated";
}

export function useCompanionSync() {
  const { user, accessToken } = useAuth();
  const userId = user?.id ?? "";
  const { refresh, loading } = useCloudRaceList();
  const [checking, setChecking] = useState(false);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(() =>
    userId ? getLastSyncAt(userId) : null,
  );
  const [lastCheckAt, setLastCheckAtState] = useState<string | null>(() =>
    userId ? getLastCheckAt(userId) : null,
  );
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [cloudRaceCount, setCloudRaceCount] = useState<number | null>(null);
  const [maxCloudRevision, setMaxCloudRevision] = useState<number | null>(null);
  const [maxDownloadedRevision, setMaxDownloadedRevision] = useState<number | null>(null);
  const [updatesAvailable, setUpdatesAvailable] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [updateResults, setUpdateResults] = useState<CompanionUpdateResult[]>([]);
  const [checkProgress, setCheckProgress] = useState<{
    current: number;
    total: number;
    raceName: string;
  } | null>(null);

  const refreshLocalStats = useCallback(async () => {
    const races = await loadRaceList();
    const downloaded = races.filter((race) => race.offlineReady);
    setDownloadedCount(downloaded.length);
    const downloadedRevisions = downloaded
      .map((race) => race.downloadedRevision)
      .filter((value): value is number => value != null);
    setMaxDownloadedRevision(
      downloadedRevisions.length > 0 ? Math.max(...downloadedRevisions) : null,
    );
    const pending = races.filter((race) =>
      needsCompanionDownload(race, race.downloadedRevision, race.offlineReady),
    );
    setUpdatesAvailable(pending.length);
  }, []);

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
      setLastCheckAtState(getLastCheckAt(userId));
    }
  }, [userId]);

  useEffect(() => {
    void refreshLocalStats();
    void refreshCloudStats();
  }, [refreshLocalStats, refreshCloudStats, loading]);

  const checkForUpdates = useCallback(async () => {
    if (!accessToken || !userId) {
      throw new Error("Sign in required to check for updates.");
    }
    setSyncError(null);
    setCheckMessage(null);
    setUpdateResults([]);
    setChecking(true);

    try {
      await refresh();
      const [cloudRaces, localRaces] = await Promise.all([
        fetchSyncRaces(accessToken),
        loadRaceList(),
      ]);
      const localById = new Map(localRaces.map((race) => [race.id, race]));

      const toDownload: Array<{
        id: string;
        name: string;
        kind: "new" | "updated";
      }> = [];

      for (const cloudRace of cloudRaces) {
        if (!cloudRace.has_bundle) {
          continue;
        }
        const local = localById.get(cloudRace.id);
        if (!local || !local.offlineReady) {
          toDownload.push({ id: cloudRace.id, name: cloudRace.name, kind: "new" });
          continue;
        }
        if (needsCompanionDownload(cloudRace, local.downloadedRevision, local.offlineReady)) {
          toDownload.push({ id: cloudRace.id, name: cloudRace.name, kind: "updated" });
        }
      }

      if (toDownload.length === 0) {
        setCheckMessage("No updates");
        const now = new Date().toISOString();
        setLastCheckAt(userId, now);
        setLastCheckAtState(now);
        await refreshLocalStats();
        return;
      }

      const results: CompanionUpdateResult[] = [];
      for (let index = 0; index < toDownload.length; index += 1) {
        const target = toDownload[index];
        setCheckProgress({
          current: index + 1,
          total: toDownload.length,
          raceName: target.name,
        });
        try {
          const bundle = await fetchCompanionBundle(accessToken, target.id, user?.id);
          await saveCompanionBundle(bundle);
          results.push({
            raceId: target.id,
            name: target.name,
            status: "downloaded",
            kind: target.kind,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Download failed.";
          results.push({
            raceId: target.id,
            name: target.name,
            status: "failed",
            error: message,
            kind: target.kind,
          });
        }
      }

      setUpdateResults(results);
      await refresh();
      await refreshLocalStats();
      await refreshCloudStats();

      const newCount = results.filter((entry) => entry.kind === "new" && entry.status === "downloaded").length;
      const updatedCount = results.filter(
        (entry) => entry.kind === "updated" && entry.status === "downloaded",
      ).length;
      const failedCount = results.filter((entry) => entry.status === "failed").length;

      setCheckMessage(formatUpdateSummary({ newCount, updatedCount, failedCount }));
      if (failedCount > 0) {
        setSyncError(
          results
            .filter((entry) => entry.status === "failed")
            .map((entry) => `${entry.name}: ${entry.error}`)
            .join(" · "),
        );
      }

      const now = new Date().toISOString();
      setLastCheckAt(userId, now);
      setLastCheckAtState(now);
      setLastSyncAt(userId, now);
      setLastSyncAtState(now);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update check failed.";
      setSyncError(message);
      throw err;
    } finally {
      setChecking(false);
      setCheckProgress(null);
    }
  }, [accessToken, refresh, refreshCloudStats, refreshLocalStats, user?.id, userId]);

  const syncNow = useCallback(async () => {
    await checkForUpdates();
  }, [checkForUpdates]);

  return {
    syncing: checking || loading,
    checking: checking || loading,
    lastSyncAt,
    lastSyncLabel: formatRelativeTime(lastSyncAt),
    lastCheckAt,
    lastCheckLabel: formatRelativeTime(lastCheckAt),
    downloadedCount,
    cloudRaceCount,
    maxCloudRevision,
    maxDownloadedRevision,
    updatesAvailable,
    syncError,
    checkMessage,
    updateResults,
    checkProgress,
    checkForUpdates,
    syncNow,
    refreshLocalStats,
  };
}

export function companionRaceVersionLabel(race: {
  companion_revision: number;
  downloadedRevision: number | null;
  offlineReady: boolean;
}): string {
  const cloud = raceVersionFields(race).version;
  const local = race.downloadedRevision ?? 0;
  if (!race.offlineReady) {
    return `Cloud v${cloud}`;
  }
  if (cloud > local) {
    return `v${local} → v${cloud}`;
  }
  return `v${local}`;
}
