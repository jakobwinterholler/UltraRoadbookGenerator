import { useMemo, useState } from "react";
import { fetchSyncRaces } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import type { CompanionBundle } from "@shared/types/sync";
import { bundleNeedsUpdate } from "@shared/sync/bundleValidation";
import { downloadRaceAssets } from "../lib/downloadRaceAssets";
import { useCloudRaceList } from "../sync/useCloudRaceList";

function bundleRevision(bundle: CompanionBundle): number {
  return bundle.revision ?? bundle.bundle_version ?? 0;
}

interface RaceDataBannerProps {
  bundle: CompanionBundle;
  onBundleUpdate: (bundle: CompanionBundle) => void;
}

export default function RaceDataBanner({ bundle, onBundleUpdate }: RaceDataBannerProps) {
  const { accessToken, user } = useAuth();
  const { races, refresh } = useCloudRaceList();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const cloudRace = useMemo(
    () => races.find((race) => race.id === bundle.race.id),
    [bundle.race.id, races],
  );

  const updateAvailable = useMemo(() => {
    if (!cloudRace || dismissed) {
      return false;
    }
    return bundleNeedsUpdate({
      cloudRevision: cloudRace.companion_revision,
      cloudChecksum: cloudRace.bundle_checksum,
      localRevision: bundleRevision(bundle),
      localChecksum: bundle.bundleChecksum,
      offlineReady: true,
      cloudClimbCount: cloudRace.significant_climb_count ?? null,
      localClimbCount: bundle.climbs?.length ?? null,
    });
  }, [bundle, cloudRace, dismissed]);

  if (!updateAvailable || !cloudRace) {
    return null;
  }

  const localRevision = bundleRevision(bundle);

  async function handleUpdate() {
    if (!accessToken) {
      setError("Sign in required to download the latest race data.");
      return;
    }
    setUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      const beforeRevision = bundleRevision(bundle);
      const beforeChecksum = bundle.bundleChecksum ?? null;

      const next = await downloadRaceAssets(accessToken, bundle.race.id, user?.id);
      onBundleUpdate(next);
      await refresh();

      const cloudRaces = await fetchSyncRaces(accessToken);
      const cloudAfter = cloudRaces.find((race) => race.id === bundle.race.id);
      const stillNeedsUpdate =
        cloudAfter != null &&
        bundleNeedsUpdate({
          cloudRevision: cloudAfter.companion_revision,
          cloudChecksum: cloudAfter.bundle_checksum,
          localRevision: bundleRevision(next),
          localChecksum: next.bundleChecksum,
          offlineReady: true,
          cloudClimbCount: cloudAfter.significant_climb_count ?? null,
          localClimbCount: next.climbs?.length ?? null,
        });

      if (stillNeedsUpdate) {
        const unchanged =
          bundleRevision(next) === beforeRevision &&
          (next.bundleChecksum ?? null) === beforeChecksum;
        setError(
          unchanged
            ? "Cloud bundle is still outdated. Open Desktop, open this race, and sync to upload the latest analysis."
            : "Downloaded the latest cloud bundle, but Desktop still has newer analysis. Sync from Desktop, then tap Update again.",
        );
        return;
      }

      setSuccess("Race data updated.");
      setDismissed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setUpdating(false);
    }
  }

  const checksumDrift =
    cloudRace.bundle_checksum &&
    bundle.bundleChecksum &&
    cloudRace.bundle_checksum !== bundle.bundleChecksum;

  return (
    <div className="shrink-0 border-b border-amber-400/25 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-100">
            A newer race version is available. Update now?
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-amber-100/60">
            Revision {localRevision} → {cloudRace.companion_revision}
            {checksumDrift ? " · checksum mismatch" : ""}
          </p>
          {success ? <p className="mt-1 text-xs text-emerald-300">{success}</p> : null}
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
        </div>
        <button
          type="button"
          disabled={updating}
          onClick={() => void handleUpdate()}
          className="min-h-[44px] shrink-0 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-[#1a1200] disabled:opacity-60"
        >
          {updating ? "Updating…" : "Update now"}
        </button>
      </div>
    </div>
  );
}
