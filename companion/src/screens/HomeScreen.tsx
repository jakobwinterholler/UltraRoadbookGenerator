import type { CompanionBundle } from "@shared/types/sync";
import { deleteCloudRace } from "@shared/api/sync";
import { importApiAvailable } from "@shared/api/importGpx";
import { useAuth } from "@shared/auth/AuthProvider";
import { getGreeting, getDisplayName, getAvatarUrl } from "@shared/auth/profile";
import { Avatar } from "@shared/ui/AuthScreens";
import { Button } from "@shared/ui/Button";
import { EmptyState } from "@shared/ui/EmptyState";
import { RaceCardSkeleton } from "@shared/ui/Skeleton";
import { ImportGpxIllustration, NoInternetIllustration, NoRacesIllustration } from "@shared/ui/design/illustrations";
import { useEffect, useRef, useState } from "react";
import CompanionDeleteRaceDialog from "../components/CompanionDeleteRaceDialog";
import CompanionRaceCard from "../components/CompanionRaceCard";
import GpxImportFlow from "../components/GpxImportFlow";
import {
  deleteCompanionRace,
  loadCompanionBundle,
  setActiveRaceId,
  type StoredRaceListItem,
} from "../db";
import { acceptGpxFile, onIncomingGpxFile } from "../lib/incomingGpx";
import { buildRaceListSections } from "../lib/raceListSections";
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
      <header className="urp-animate-fade-up flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-safe-top">
        <div className="min-w-0 flex-1">
          <p className="text-[1.75rem] font-semibold tracking-tight text-white">{greeting}</p>
          <p className="mt-1.5 text-sm text-white/50">Your races</p>
          {autoSyncing ? (
            <p className="mt-2 text-xs font-medium text-sky-300">Checking cloud for updates…</p>
          ) : updatesAvailable > 0 ? (
            <p className="mt-2 text-xs font-medium text-orange-300">
              {updatesAvailable} update{updatesAvailable === 1 ? "" : "s"} available
            </p>
          ) : (
            <p className="mt-2 text-xs text-white/30">Checked {lastCheckLabel}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            dark
            disabled={checking}
            onClick={() => void checkForUpdates().catch(() => undefined)}
          >
            {checking ? "Refreshing…" : "Refresh"}
          </Button>
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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

        <Button
          variant="primary"
          size="lg"
          dark
          className="mb-6 w-full"
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
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-lg font-bold">
            +
          </span>
          New Race
        </Button>

        {!online ? (
          <EmptyState
            dark
            className="mb-6 rounded-2xl bg-white/[0.02] py-10"
            illustration={<NoInternetIllustration />}
            title="You're offline"
            description="Downloaded races still work. Import and cloud sync need an internet connection."
          />
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

        {import.meta.env.DEV && syncDebugLog.length > 0 ? (
          <details className="mb-4 rounded-xl bg-white/[0.02] px-3 py-2 text-xs text-white/55 ring-1 ring-white/10">
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
          <div className="space-y-4">
            <RaceCardSkeleton dark />
            <RaceCardSkeleton dark />
          </div>
        ) : sections.length === 0 ? (
          <EmptyState
            dark
            illustration={<NoRacesIllustration />}
            title="No races yet"
            description="Import a GPX from Files, AirDrop, Komoot, or RideWithGPS — full analysis runs in the cloud."
            action={
              online && canImport ? (
                <Button
                  variant="primary"
                  dark
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImportGpxIllustration className="h-5 w-5" />
                  Import GPX
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.id}>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
                  {section.title}
                </h2>
                <ul className="space-y-4">
                  {section.races.map((race, index) => (
                    <li key={race.id}>
                      <CompanionRaceCard
                        race={race}
                        busy={busyRaceId === race.id}
                        downloadProgress={busyRaceId === race.id ? downloadProgress : null}
                        staggerIndex={Math.min(index + 1, 4)}
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

      <CompanionDeleteRaceDialog
        open={Boolean(deleteTarget)}
        raceName={deleteTarget?.name ?? ""}
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteRace()}
      />
    </div>
  );
}
