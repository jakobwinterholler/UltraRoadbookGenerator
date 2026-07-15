import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSyncRaces } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import { formatUpdateSummary, needsCompanionDownload } from "@shared/sync/raceVersion";
import { logSyncDebug } from "@shared/sync/syncDebugLog";
import { setLastCheckAt, setLastSyncAt } from "@shared/sync/syncMeta";
import { downloadRaceAssets } from "../lib/downloadRaceAssets";
import { loadRaceList } from "../db";
import { useCloudRaceList } from "./useCloudRaceList";

export interface AutoCloudSyncState {
  autoSyncing: boolean;
  autoSyncMessage: string | null;
  dismissAutoSyncMessage: () => void;
}

/**
 * On Companion startup, silently check cloud for newer race bundles and download them.
 * Shows a toast when updates were applied; manual "Refresh routes" remains available.
 */
export function useAutoCloudSync(): AutoCloudSyncState {
  const { user, accessToken } = useAuth();
  const userId = user?.id ?? "";
  const { refresh, loading } = useCloudRaceList();
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncMessage, setAutoSyncMessage] = useState<string | null>(null);
  const ranRef = useRef(false);
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  const runAutoSync = useCallback(async () => {
    if (!accessToken || !userId || !online) {
      return;
    }
    setAutoSyncing(true);
    try {
      logSyncDebug("auto-sync", "Startup cloud check");
      await refresh();
      const [cloudRaces, localRaces] = await Promise.all([
        fetchSyncRaces(accessToken),
        loadRaceList(),
      ]);
      const localById = new Map(localRaces.map((race) => [race.id, race]));
      const toDownload: Array<{ id: string; name: string; kind: "new" | "updated" }> = [];

      for (const cloudRace of cloudRaces) {
        if (!cloudRace.has_bundle) {
          continue;
        }
        const local = localById.get(cloudRace.id);
        const needsDownload = needsCompanionDownload(
          cloudRace,
          local?.downloadedRevision ?? null,
          local?.offlineReady ?? false,
          local?.downloadedChecksum,
        );
        if (needsDownload) {
          const kind = !local?.offlineReady ? "new" : "updated";
          toDownload.push({ id: cloudRace.id, name: cloudRace.name, kind });
        }
      }

      if (toDownload.length === 0) {
        const now = new Date().toISOString();
        setLastCheckAt(userId, now);
        return;
      }

      logSyncDebug("auto-sync", `Downloading ${toDownload.length} race(s)`, toDownload);
      let newCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      for (const target of toDownload) {
        try {
          await downloadRaceAssets(accessToken, target.id, user?.id);
          if (target.kind === "new") {
            newCount += 1;
          } else {
            updatedCount += 1;
          }
        } catch (err) {
          failedCount += 1;
          logSyncDebug(
            "auto-sync",
            `${target.name} download failed: ${err instanceof Error ? err.message : "unknown"}`,
          );
        }
      }

      await refresh();
      const now = new Date().toISOString();
      setLastCheckAt(userId, now);
      if (newCount + updatedCount > 0) {
        setLastSyncAt(userId, now);
        setAutoSyncMessage(formatUpdateSummary({ newCount, updatedCount, failedCount }));
      }
    } catch (err) {
      logSyncDebug(
        "auto-sync",
        `Startup sync failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      setAutoSyncing(false);
    }
  }, [accessToken, online, refresh, user?.id, userId]);

  useEffect(() => {
    if (loading || ranRef.current || !accessToken || !userId) {
      return;
    }
    ranRef.current = true;
    void runAutoSync();
  }, [accessToken, loading, runAutoSync, userId]);

  useEffect(() => {
    const onOnline = () => {
      if (!ranRef.current) {
        ranRef.current = true;
        void runAutoSync();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runAutoSync]);

  const dismissAutoSyncMessage = useCallback(() => {
    setAutoSyncMessage(null);
  }, []);

  return { autoSyncing, autoSyncMessage, dismissAutoSyncMessage };
}
