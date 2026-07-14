import { useMemo } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { verificationStatsLine } from "@shared/race/applyVerificationToBundle";
import { countNearbyVerificationStops } from "@shared/race/sortVerificationQueue";
import type { CompanionVerificationUpdates } from "@shared/types/verification";
import { useCompanion } from "../context/CompanionContext";
import { sortedVerificationQueue } from "../lib/verificationProximity";
import { useVerificationActions } from "../lib/useVerificationActions";
import type { CompanionStop } from "../types";
import UndoToast from "../components/UndoToast";
import VerificationSwipeStack, {
  type VerificationQuickAction,
} from "../components/VerificationSwipeStack";

function updatesForAction(action: VerificationQuickAction): CompanionVerificationUpdates {
  switch (action) {
    case "verified":
      return { status: "verified" };
    case "closed":
      return {
        status: "rejected",
        rejectReason: "closed",
        temporarilyClosed: true,
      };
    case "wrong_location":
      return {
        status: "rejected",
        rejectReason: "different_location",
      };
    case "needs_review":
      return {
        status: "rejected",
        rejectReason: "could_not_verify",
      };
  }
}

export default function VerificationScreen() {
  const { bundle, gps, currentKm } = useCompanion();
  const { user } = useAuth();
  const { submitVerification, undo, performUndo } = useVerificationActions(user?.id ?? null);

  const queue = useMemo(
    () =>
      sortedVerificationQueue(bundle, {
        lat: gps.lat,
        lon: gps.lon,
        currentKm,
      }),
    [bundle, currentKm, gps.lat, gps.lon],
  );

  const nearbyCount = useMemo(
    () => countNearbyVerificationStops(queue, gps.lat, gps.lon),
    [gps.lat, gps.lon, queue],
  );

  const statsLine = useMemo(() => verificationStatsLine(bundle), [bundle]);

  async function handleAction(stop: CompanionStop, action: VerificationQuickAction) {
    await submitVerification(stop, {
      ...updatesForAction(action),
      category: stop.category,
    });
  }

  return (
    <div className="verify-tab flex h-full min-h-0 flex-col">
      <header className="verify-tab__header shrink-0 border-b border-white/8 px-4 pb-2 pt-safe-top">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">Verify</p>
            <p className="mt-0.5 truncate text-sm font-medium tabular-nums text-white/75">{statsLine}</p>
          </div>
          {nearbyCount > 0 ? (
            <p className="shrink-0 rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold text-orange-200 ring-1 ring-orange-400/30">
              {nearbyCount} nearby
            </p>
          ) : null}
        </div>
      </header>

      <div className="verify-tab__stack min-h-0 flex-1">
        <VerificationSwipeStack
          stops={queue}
          totalKm={bundle.race.distanceKm}
          gpsLat={gps.lat}
          gpsLon={gps.lon}
          routeCoordinates={bundle.route.coordinates}
          onAction={(stop, action) => {
            void handleAction(stop, action);
          }}
        />
      </div>

      {undo ? (
        <UndoToast
          stopName={undo.stopName}
          message="Pending desktop review"
          onUndo={() => void performUndo()}
        />
      ) : null}
    </div>
  );
}
