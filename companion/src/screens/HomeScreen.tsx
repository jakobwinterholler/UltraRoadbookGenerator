import { fetchCompanionBundle } from "@shared/api/sync";
import type { CompanionBundle } from "@shared/types/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import { getGreeting, getDisplayName, getAvatarUrl } from "@shared/auth/profile";
import { Avatar } from "@shared/ui/AuthScreens";
import {
  getCompanionRaceSyncStatus,
  SyncStatusBadge,
} from "@shared/ui/SyncStatusBadge";
import { useState } from "react";
import {
  loadCompanionBundle,
  saveCompanionBundle,
  setActiveRaceId,
  type StoredRaceListItem,
} from "../db";
import { useCloudRaceList } from "../sync/useCloudRaceList";

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
  const [busyRaceId, setBusyRaceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const greeting = getGreeting(getDisplayName(user));

  async function handleOpenRace(race: StoredRaceListItem) {
    setActionError(null);
    if (race.offlineReady) {
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
      setActionError("Analyze this race in Ultra Roadbook first.");
      return;
    }

    setBusyRaceId(race.id);
    try {
      const bundle = await fetchCompanionBundle(accessToken, race.id, user?.id);
      await saveCompanionBundle(bundle);
      await refresh();
      onOpenRace(bundle);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusyRaceId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
      <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-white">{greeting}</p>
          <p className="mt-1 text-sm text-white/45">Your races</p>
        </div>
        <button type="button" onClick={onOpenAccount} className="shrink-0 rounded-full">
          <Avatar
            name={getDisplayName(user)}
            imageUrl={getAvatarUrl(user)}
            size="md"
            variant="dark"
          />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
        {actionError ? <p className="mb-3 text-sm text-red-300">{actionError}</p> : null}

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
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-white">{race.name}</p>
                        <p className="mt-1 text-sm tabular-nums text-white/45">
                          {race.distance_km
                            ? `${Math.round(race.distance_km)} km`
                            : "Not analyzed"}
                          {race.elevation_gain_m
                            ? ` · +${Math.round(race.elevation_gain_m).toLocaleString()} m`
                            : ""}
                        </p>
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
