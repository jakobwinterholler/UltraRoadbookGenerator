import { useMemo, useState } from "react";
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

  const cloudRace = useMemo(
    () => races.find((race) => race.id === bundle.race.id),
    [bundle.race.id, races],
  );

  const updateAvailable = useMemo(() => {
    if (!cloudRace) {
      return false;
    }
    return bundleNeedsUpdate({
      cloudRevision: cloudRace.companion_revision,
      cloudChecksum: cloudRace.bundle_checksum,
      localRevision: bundleRevision(bundle),
      localChecksum: bundle.bundleChecksum,
      offlineReady: true,
    });
  }, [bundle, cloudRace]);

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
    try {
      const next = await downloadRaceAssets(accessToken, bundle.race.id, user?.id);
      onBundleUpdate(next);
      await refresh();
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
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
        </div>
        <button
          type="button"
          disabled={updating}
          onClick={() => void handleUpdate()}
          className="min-h-[40px] shrink-0 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-[#1a1200] disabled:opacity-60"
        >
          {updating ? "Updating…" : "Update now"}
        </button>
      </div>
    </div>
  );
}
