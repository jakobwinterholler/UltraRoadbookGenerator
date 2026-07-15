import { fetchCompanionBundle } from "@shared/api/sync";
import type { CompanionBundle } from "@shared/types/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import { getGreeting, getDisplayName, getAvatarUrl } from "@shared/auth/profile";
import { Avatar } from "@shared/ui/AuthScreens";
import {
  getCompanionRaceSyncStatus,
  SyncStatusBadge,
} from "@shared/ui/SyncStatusBadge";
import { ReadinessScoreBadge } from "@shared/ui/RaceReadinessDisplay";
import { useState } from "react";
import {
  loadCompanionBundle,
  saveCompanionBundle,
  setActiveRaceId,
  type StoredRaceListItem,
} from "../db";
import { useCloudRaceList } from "../sync/useCloudRaceList";
import { useCompanionSync } from "../sync/useCompanionSync";

interface HomeScreenProps {
  onOpenRace: (bundle: CompanionBundle) => void;
  onOpenAccount: () => void;
}

function RaceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="h-5 w-2/3 animate-pulse rounded-lg bg-white/10" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded-lg bg-white/8" />
    </div>
  );
}

function EmptyRaces() {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
      <p className="text-base font-medium text-white">No races yet</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/50">
        Import and analyze a route in Ultra Roadbook on your computer while signed in. Your races
        will appear here automatically.
      </p>
    </div>
  );
}

export default function HomeScreen({ onOpenRace, onOpenAccount }: HomeScreenProps) {
  const { accessToken, user } = useAuth();
  const { races, loading, error, refresh } = useCloudRaceList();
  const {
    checking,
    updatesAvailable,
    checkMessage,
    checkForUpdates,
    lastCheckLabel,
    syncError,
    syncDebugLog,
    updateResults,
  } = useCompanionSync();
  const [busyRaceId, setBusyRaceId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const greeting = getGreeting(getDisplayName(user));

  async function handleOpenRace(race: StoredRaceListItem) {
    setActionError(null);
    const needsDownload =
      !race.offlineReady ||
      (race.downloadedRevision !== null && race.companion_revision > race.downloadedRevision);

    if (!needsDownload) {
      const bundle = await loadCompanionBundle(race.id);
      if (bundle) {
        await setActiveRaceId(race.id);
        onOpenRace(bundle);
        return;
      }
    }

    if (!accessToken) {
      setActionError("Sign in required to download this race.");
      return;
    }
    if (!race.has_bundle) {
      setActionError("Analyze this race in Ultra Roadbook on your computer, then tap Sync now in Account.");
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
      const bundle = await fetchCompanionBundle(accessToken, race.id, user?.id);
      setDownloadProgress(95);
      await saveCompanionBundle(bundle);
      setDownloadProgress(100);
      await refresh();
      await setActiveRaceId(race.id);
      onOpenRace(bundle);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      window.clearInterval(progressTimer);
      setBusyRaceId(null);
      window.setTimeout(() => setDownloadProgress(null), 400);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
      <header className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-safe-top">
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-semibold tracking-tight text-white">{greeting}</p>
          <p className="mt-1 text-sm text-white/45">Your races</p>
          {updatesAvailable > 0 ? (
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
            {checking ? "Checking…" : "Check for updates"}
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
        {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
        {syncError ? <p className="mb-3 text-sm text-red-300">{syncError}</p> : null}
        {actionError ? <p className="mb-3 text-sm text-red-300">{actionError}</p> : null}
        {checkMessage ? (
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
            {updateResults.some((entry) => entry.reason) ? (
              <ul className="mt-2 space-y-1 border-t border-white/8 pt-2">
                {updateResults.map((entry) => (
                  <li key={entry.raceId}>
                    {entry.name}: {entry.status}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                    {entry.error ? ` — ${entry.error}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <RaceCardSkeleton />
            <RaceCardSkeleton />
          </div>
        ) : races.length === 0 ? (
          <EmptyRaces />
        ) : (
          <ul className="space-y-3">
            {races.map((race) => {
              const syncStatus = getCompanionRaceSyncStatus({
                ...race,
                busy: busyRaceId === race.id,
              });
              return (
                <li key={race.id}>
                  <button
                    type="button"
                    disabled={busyRaceId === race.id}
                    onClick={() => void handleOpenRace(race)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-emerald-400/25 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-white">{race.name}</p>
                        <p className="mt-1 text-sm tabular-nums text-white/45">
                          {race.distance_km
                            ? `${Math.round(race.distance_km)} km`
                            : "Not analyzed"}
                          {race.elevation_gain_m
                            ? ` · +${Math.round(race.elevation_gain_m).toLocaleString()} m`
                            : ""}
                        </p>
                        {race.readiness_score != null ? (
                          <div className="mt-2">
                            <ReadinessScoreBadge score={race.readiness_score} dark />
                          </div>
                        ) : null}
                        {busyRaceId === race.id && downloadProgress !== null ? (
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
                      {syncStatus ? (
                        <SyncStatusBadge status={syncStatus} variant="dark" className="shrink-0" />
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
