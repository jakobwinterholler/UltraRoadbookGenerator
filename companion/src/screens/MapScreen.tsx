import { useState } from "react";
import { useCompanion } from "../context/CompanionContext";
import type { CompanionClimb } from "@shared/types/sync";
import ClimbSheet from "../components/ClimbSheet";
import FloatingCard from "../components/FloatingCard";
import RouteMapView from "../components/RouteMapView";
import StopSheet from "../components/StopSheet";

export default function MapScreen({ embedded = false }: { embedded?: boolean }) {
  const {
    bundle,
    currentKm,
    selectedStop,
    selectStop,
    showUnverified,
    setShowUnverified,
    mapGesturesLocked,
    setMapGesturesLocked,
    gps,
  } = useCompanion();
  const [showClimbs, setShowClimbs] = useState(Boolean(bundle.climbs?.length));
  const [selectedClimb, setSelectedClimb] = useState<CompanionClimb | null>(null);

  const hasClimbs = (bundle.climbs?.length ?? 0) > 0;
  const followPaused = !embedded && gps.lat != null && gps.lon != null && !mapGesturesLocked;

  if (embedded) {
    return (
      <div className="relative h-full min-h-0">
        <RouteMapView embedded showClimbs={false} />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <RouteMapView
        showClimbs={showClimbs}
        onClimbSelect={(climbId) => {
          const climb = bundle.climbs?.find((item) => item.id === climbId) ?? null;
          setSelectedClimb(climb);
        }}
      />

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
        <FloatingCard className="pointer-events-auto p-1">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-white/85">
            <input
              type="checkbox"
              checked={showUnverified}
              onChange={(event) => setShowUnverified(event.target.checked)}
              className="h-4 w-4 rounded accent-orange-500"
            />
            Unverified
          </label>
          {hasClimbs ? (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 border-t border-white/10 px-3 py-2 text-sm text-white/85">
              <input
                type="checkbox"
                checked={showClimbs}
                onChange={(event) => setShowClimbs(event.target.checked)}
                className="h-4 w-4 rounded accent-amber-500"
              />
              Climbs
            </label>
          ) : null}
        </FloatingCard>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-10">
        <FloatingCard className="pointer-events-auto overflow-hidden">
          <button
            type="button"
            onClick={() => setMapGesturesLocked(!mapGesturesLocked)}
            className="flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-white/90 hover:bg-white/5"
            aria-pressed={mapGesturesLocked}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                mapGesturesLocked ? "bg-sky-500/25 text-sky-300" : "bg-white/10 text-white/50"
              }`}
              aria-hidden
            >
              ◎
            </span>
            {mapGesturesLocked ? "Following" : "Follow off"}
          </button>
        </FloatingCard>
      </div>

      {followPaused ? (
        <button
          type="button"
          onClick={() => setMapGesturesLocked(true)}
          className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full bg-sky-500/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 backdrop-blur transition active:scale-[0.97]"
          style={{ marginBottom: "max(0px, env(safe-area-inset-bottom))" }}
        >
          Resume follow
        </button>
      ) : null}

      <StopSheet
        stop={selectedStop}
        bundle={bundle}
        onClose={() => selectStop(null)}
        onSelectAlternative={selectStop}
      />

      <ClimbSheet
        climb={selectedClimb}
        totalKm={bundle.race.distanceKm}
        currentKm={currentKm}
        onClose={() => setSelectedClimb(null)}
      />
    </div>
  );
}
