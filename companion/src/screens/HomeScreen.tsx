import type { CompanionBundle } from "@shared/types/sync";
import { deleteCloudRace } from "@shared/api/sync";
import { importApiAvailable } from "@shared/api/importGpx";
import { useAuth } from "@shared/auth/AuthProvider";
import { getGreeting, getDisplayName, getAvatarUrl } from "@shared/auth/profile";
import { Avatar } from "@shared/ui/AuthScreens";
import { DeleteRaceDialog } from "@shared/ui/DeleteRaceDialog";
import {
  getCompanionRaceSyncStatus,
  SyncStatusBadge,
} from "@shared/ui/SyncStatusBadge";
import { ReadinessScoreBadge } from "@shared/ui/RaceReadinessDisplay";
import { useEffect, useRef, useState } from "react";
import GpxImportFlow from "../components/GpxImportFlow";
import {
  deleteCompanionRace,
  loadCompanionBundle,
  setActiveRaceId,
  type StoredRaceListItem,
} from "../db";
import { acceptGpxFile, onIncomingGpxFile } from "../lib/incomingGpx";
import { buildRaceListSections, formatLastUpdated } from "../lib/raceListSections";
import { downloadRaceAssets } from "../lib/downloadRaceAssets";
import { useCloudRaceList } from "../sync/useCloudRaceList";
import { useAutoCloudSync } from "../sync/useAutoCloudSync";
import { useCompanionSync } from "../sync/useCompanionSync";
import type { CompanionTab } from "../components/BottomNav";

interface HomeScreenProps {
  onOpenRace: (bundle: CompanionBundle, options?: { tab?: CompanionTab; autoExport?: "coros" | "garmin" | "wahoo" }) => void;
  onOpenAccount: () => void;
  deepLink?: {
    raceId: string;
    tab?: CompanionTab;
    autoExport?: "coros" | "garmin" | "wahoo";
  } | null;
}

function RaceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="h-5 w-2/3 animate-pulse rounded-lg bg-white/10" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded-lg bg-white/8" />
    </div>
  );
}

function verifiedPercent(race: StoredRaceListItem): number | null {
  return race.verified_percent ?? null;
}

function RaceCard({
  race,
  busy,
  downloadProgress,
  onOpen,
  onDelete,
}: {
  race: StoredRaceListItem;
  busy: boolean;
  downloadProgress: number | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const syncStatus = getCompanionRaceSyncStatus({ ...race, busy });
  const badgeLabel =
    race.offlineReady && race.source === "local-import"
      ? "Imported"
      : race.offlineReady
        ? "Downloaded"
        : race.has_bundle
          ? "Cloud"
          : null;

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-emerald-400/25 hover:bg-white/[0.05]">
      <button
        type="button"
        disabled={busy}
        onClick={onOpen}
        className="w-full p-5 text-left"
      >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-white">{race.name}</p>
          <p className="mt-1 text-sm tabular-nums text-white/45">
            {race.distance_km ? `${Math.round(race.distance_km)} km` : "Not analyzed"}
            {race.elevation_gain_m
              ? ` · +${Math.round(race.elevation_gain_m).toLocaleString()} m`
              : ""}
          </p>
          <p className="mt-1 text-xs text-white/35">
            Updated {formatLastUpdated(race.updated_at)}
          </p>
          {race.readiness_score != null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ReadinessScoreBadge score={race.readiness_score} dark />
              {verifiedPercent(race) != null ? (
                <span className="text-[11px] text-white/40">{verifiedPercent(race)}% verified</span>
              ) : null}
            </div>
          ) : null}
          {busy && downloadProgress !== null ? (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-sky-200/80">
                <span>Downloading race…</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-200"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {badgeLabel ? (
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
              {badgeLabel}
            </span>
          ) : null}
          {syncStatus ? <SyncStatusBadge status={syncStatus} variant="dark" /> : null}
        </div>
      </div>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${race.name}`}
        className="absolute right-3 top-3 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-white/35 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export default function HomeScreen({ onOpenRace, onOpenAccount, deepLink }: HomeScreenProps) {
  const { accessToken, user } = useAuth();
  const { races, loading, error, refresh } = useCloudRaceList();
  const { autoSyncing, autoSyncMessage, dismissAutoSyncMessage } = useAutoCloudSync();
  const {
    checking,
    updatesAvailable,
    checkMessage,
    checkForUpdates,
    lastCheckLabel,
    syncError,
    syncDebugLog,
  } = useCompanionSync();
  const [busyRaceId, setBusyRaceId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoredRaceListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deepLinkHandledRef = useRef(false);

  const greeting = getGreeting(getDisplayName(user));
  const sections = buildRaceListSections(races);
  const canImport = importApiAvailable();

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    onIncomingGpxFile((file) => setImportFile(file));
    return () => onIncomingGpxFile(null);
  }, []);

  useEffect(() => {
    if (!deepLink?.raceId || loading || races.length === 0 || deepLinkHandledRef.current) {
      return;
    }
    const target = races.find((race) => race.id === deepLink.raceId);
    if (!target) {
      return;
    }
    deepLinkHandledRef.current = true;
    void handleOpenRace(target, {
      tab: deepLink.tab ?? "share",
      autoExport: deepLink.autoExport,
    });
  }, [deepLink, loading, races]);

  async function handleOpenRace(
    race: StoredRaceListItem,
    options?: { tab?: CompanionTab; autoExport?: "coros" | "garmin" | "wahoo" },
  ) {
    setActionError(null);
    const needsDownload =
      !race.offlineReady ||
      (race.downloadedRevision !== null && race.companion_revision > race.downloadedRevision);

    if (!needsDownload) {
      const bundle = await loadCompanionBundle(race.id);
      if (bundle) {
        await setActiveRaceId(race.id);
        onOpenRace(bundle, options);
        return;
      }
    }

    if (!accessToken) {
      setActionError("Sign in required to download this race.");
      return;
    }
    if (!race.has_bundle) {
      setActionError("This race has not been analyzed yet.");
      return;
    }

    setBusyRaceId(race.id);
    setDownloadProgress(0);
    const progressTimer = window.setInterval(() => {
      setDownloadProgress((value) => {
        if (value === null || value >= 90) {
          return value;
        }
        return value + 8;
      });
    }, 200);

    try {
      const bundle = await downloadRaceAssets(accessToken, race.id, user?.id);
      setDownloadProgress(100);
      await refresh();
      await setActiveRaceId(race.id);
      onOpenRace(bundle, options);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      window.clearInterval(progressTimer);
      setBusyRaceId(null);
      window.setTimeout(() => setDownloadProgress(null), 400);
    }
  }

  function handleFileSelection(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!acceptGpxFile(file)) {
      setActionError("Please choose a .gpx file.");
      return;
    }
    setActionError(null);
    setImportFile(file!);
  }

  function handleImportComplete(bundle: CompanionBundle) {
    setImportFile(null);
    void refresh().then(() => {
      void setActiveRaceId(bundle.race.id);
      onOpenRace(bundle);
    });
  }

  async function confirmDeleteRace() {
    if (!deleteTarget) {
      return;
    }
    setDeleteBusy(true);
    setActionError(null);
    try {
      if (accessToken && deleteTarget.source !== "local-import" && deleteTarget.has_bundle) {
        await deleteCloudRace(accessToken, deleteTarget.id);
      }
      await deleteCompanionRace(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete race.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
      <header className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-safe-top">
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-semibold tracking-tight text-white">{greeting}</p>
          <p className="mt-1 text-sm text-white/45">Your races</p>
          {autoSyncing ? (
            <p className="mt-1 text-xs font-medium text-sky-300">Checking cloud for updates…</p>
          ) : updatesAvailable > 0 ? (
            <p className="mt-1 text-xs font-medium text-orange-300">
              {updatesAvailable} update{updatesAvailable === 1 ? "" : "s"} available
            </p>
          ) : (
            <p className="mt-1 text-xs text-white/30">Checked {lastCheckLabel}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={checking}
            onClick={() => void checkForUpdates().catch(() => undefined)}
            className="min-h-[40px] rounded-full border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white/85 disabled:opacity-50"
          >
            {checking ? "Refreshing…" : "Refresh routes"}
          </button>
          <button type="button" onClick={onOpenAccount} className="shrink-0 rounded-full">
            <Avatar
              name={getDisplayName(user)}
              imageUrl={getAvatarUrl(user)}
              size="md"
              variant="dark"
            />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          className="hidden"
          onChange={(event) => {
            handleFileSelection(event.target.files);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => {
            if (!online) {
              setActionError("Connect to the internet to import and analyze a GPX route.");
              return;
            }
            if (!canImport) {
              setActionError("Route analysis server is not configured for this build.");
              return;
            }
            fileInputRef.current?.click();
          }}
          className="mb-4 flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 text-base font-semibold text-emerald-200 transition hover:bg-emerald-500/15"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-lg font-bold text-black">
            +
          </span>
          New Race
        </button>

        {!online ? (
          <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Offline — downloaded races still work. Import and cloud sync need internet.
          </p>
        ) : null}

        {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
        {syncError ? <p className="mb-3 text-sm text-red-300">{syncError}</p> : null}
        {actionError ? <p className="mb-3 text-sm text-red-300">{actionError}</p> : null}
        {autoSyncMessage ? (
          <div className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
            <p className="text-sm text-emerald-200">{autoSyncMessage}</p>
            <button
              type="button"
              onClick={dismissAutoSyncMessage}
              className="shrink-0 text-xs font-medium text-emerald-200/70 hover:text-emerald-100"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {checkMessage && !autoSyncMessage ? (
          <p className="mb-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {checkMessage}
          </p>
        ) : null}

        {syncDebugLog.length > 0 ? (
          <details className="mb-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/55">
            <summary className="cursor-pointer font-medium text-white/70">Sync debug log</summary>
            <ul className="mt-2 space-y-1">
              {syncDebugLog.map((entry) => (
                <li key={`${entry.at}-${entry.stage}-${entry.detail}`}>
                  <span className="text-white/35">{entry.stage}</span> {entry.detail}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <RaceCardSkeleton />
            <RaceCardSkeleton />
          </div>
        ) : sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-base font-medium text-white">No races yet</p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/50">
              Tap <span className="font-medium text-white/70">New Race</span> to import a GPX from
              Files, AirDrop, Komoot, or RideWithGPS — full analysis runs in the cloud.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.id}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/35">
                  {section.title}
                </h2>
                <ul className="space-y-3">
                  {section.races.map((race) => (
                    <li key={race.id}>
                      <RaceCard
                        race={race}
                        busy={busyRaceId === race.id}
                        downloadProgress={busyRaceId === race.id ? downloadProgress : null}
                        onOpen={() => void handleOpenRace(race)}
                        onDelete={() => setDeleteTarget(race)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {importFile ? (
        <GpxImportFlow
          file={importFile}
          online={online}
          onClose={() => setImportFile(null)}
          onComplete={handleImportComplete}
        />
      ) : null}

      <DeleteRaceDialog
        open={Boolean(deleteTarget)}
        raceName={deleteTarget?.name ?? ""}
        distanceKm={deleteTarget?.distance_km}
        elevationGainM={deleteTarget?.elevation_gain_m}
        cloudSynced={deleteTarget?.has_bundle ?? null}
        lastModified={deleteTarget?.updated_at}
        busy={deleteBusy}
        variant="dark"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteRace()}
      />
    </div>
  );
}
