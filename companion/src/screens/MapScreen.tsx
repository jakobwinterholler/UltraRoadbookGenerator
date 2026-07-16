import { useEffect, useRef, useState } from "react";
import { poiOsmKey } from "@shared/race/discoverStops";
import { useCompanion } from "../context/CompanionContext";
import type { CompanionClimb } from "@shared/types/sync";
import ClimbSheet from "../components/ClimbSheet";
import DiscoverCandidateDetail from "../components/discovery/DiscoverCandidateDetail";
import DiscoverStopsControls from "../components/discovery/DiscoverStopsControls";
import FloatingCard from "../components/FloatingCard";
import MapControls from "../components/MapControls";
import RouteMapView, { type RouteMapHandle } from "../components/RouteMapView";
import StopSheet from "../components/StopSheet";
import { useDiscoverStops } from "../planning/useDiscoverStops";

export default function MapScreen({ embedded = false }: { embedded?: boolean }) {
  const {
    bundle,
    currentKm,
    selectedStop,
    selectStop,
    showUnverified,
    setShowUnverified,
    followGps,
    setFollowGps,
    gps,
  } = useCompanion();
  const mapRef = useRef<RouteMapHandle | null>(null);
  const [showClimbs, setShowClimbs] = useState(Boolean(bundle.climbs?.length));
  const [selectedClimb, setSelectedClimb] = useState<CompanionClimb | null>(null);
  const discovery = useDiscoverStops({
    bundle,
    onSelectStop: selectStop,
  });

  useEffect(() => {
    if ((bundle.climbs?.length ?? 0) > 0) {
      setShowClimbs(true);
    }
  }, [bundle.race.id, bundle.climbs?.length]);

  const hasClimbs = (bundle.climbs?.length ?? 0) > 0;
  const gpsActive = gps.lat != null && gps.lon != null;

  useEffect(() => {
    if (selectedStop) {
      setFollowGps(false);
    }
  }, [selectedStop, setFollowGps]);

  useEffect(() => {
    if (selectedStop && discovery.active) {
      discovery.toggleDiscovery();
    }
  }, [selectedStop, discovery.active, discovery.toggleDiscovery]);

  if (embedded) {
    return (
      <div className="relative h-full min-h-0">
        <RouteMapView embedded showClimbs={false} />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <div className="absolute inset-0">
        <RouteMapView
          ref={mapRef}
          showClimbs={showClimbs}
          onClimbSelect={(climbId) => {
            const climb = bundle.climbs?.find((item) => item.id === climbId) ?? null;
            setSelectedClimb(climb);
          }}
          discoverActive={discovery.active}
          discoverCandidates={discovery.candidates}
          selectedDiscoverKey={discovery.selectedCandidateKey}
          onDiscoverBoundsChange={discovery.handleBoundsChange}
          onSelectDiscoverCandidate={(candidate) =>
            discovery.selectCandidate(poiOsmKey(candidate.osmType, candidate.osmId))
          }
        />
      </div>

      {!selectedStop ? (
        <>
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
            {hasClimbs ? (
              <FloatingCard className="pointer-events-none px-3 py-2 text-xs font-medium text-white/80">
                {bundle.climbs?.length ?? 0} climbs
              </FloatingCard>
            ) : null}
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

          <MapControls
            followGps={followGps}
            gpsActive={gpsActive}
            onRecenter={() => mapRef.current?.recenter()}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onResetNorth={() => mapRef.current?.resetNorth()}
          />

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 mx-auto max-w-md">
            {discovery.selectedCandidate ? (
              <DiscoverCandidateDetail
                candidate={discovery.selectedCandidate}
                promoting={discovery.promoting}
                onPromote={() => discovery.promoteCandidate(discovery.selectedCandidate!)}
                onDismiss={() => discovery.dismissCandidate(discovery.selectedCandidate!)}
              />
            ) : (
              <DiscoverStopsControls
                active={discovery.active}
                loading={discovery.loading}
                candidateCount={discovery.candidates.length}
                onToggle={discovery.toggleDiscovery}
              />
            )}
          </div>
        </>
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
