import { useEffect, useMemo, useRef, useState } from "react";
import { useCompanion } from "../context/CompanionContext";
import type { CompanionClimb, CompanionStop } from "@shared/types/sync";
import ClimbSheet from "../components/ClimbSheet";
import DiscoverStopsControls from "../components/discovery/DiscoverStopsControls";
import MapControls from "../components/MapControls";
import NextVerifiedStopCard from "../components/NextVerifiedStopCard";
import ResupplyElevationProfile from "../components/ResupplyElevationProfile";
import RouteMapView, { type RouteMapHandle } from "../components/RouteMapView";
import StopSheet from "../components/StopSheet";
import { nextResupplyStop } from "../lib/raceExecution";
import { useDiscoverStops } from "../planning/useDiscoverStops";

export default function RaceScreen() {
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
  const [selectedClimb, setSelectedClimb] = useState<CompanionClimb | null>(null);
  const discovery = useDiscoverStops({
    bundle,
    onSelectStop: selectStop,
  });

  const nextStop = useMemo(
    () => nextResupplyStop(bundle, currentKm, false),
    [bundle, currentKm],
  );

  const gpsActive = gps.lat != null && gps.lon != null;
  const showClimbs = (bundle.climbs?.length ?? 0) > 0;

  useEffect(() => {
    if (selectedStop) {
      setFollowGps(false);
    }
  }, [selectedStop, setFollowGps]);

  function handleStopSheetClose() {
    selectStop(null);
  }

  function handleStopVerified(stop: CompanionStop) {
    if (discovery.isDiscoveryCandidate(stop.osmId, stop.osmType)) {
      discovery.handleStopVerified(stop);
    }
    handleStopSheetClose();
  }

  function handleStopSkipped(stop: CompanionStop) {
    if (discovery.isDiscoveryCandidate(stop.osmId, stop.osmType)) {
      discovery.handleStopSkipped(stop);
    }
    handleStopSheetClose();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-white/8 px-4 pb-3">
        <NextVerifiedStopCard bundle={bundle} currentKm={currentKm} compact />
        <ResupplyElevationProfile
          bundle={bundle}
          riderKm={currentKm}
          nextStopKm={nextStop?.km ?? null}
          viewportStartKm={Math.max(0, currentKm - 8)}
          viewportEndKm={Math.min(bundle.race.distanceKm, (nextStop?.km ?? currentKm + 12) + 2)}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <RouteMapView
          ref={mapRef}
          showClimbs={showClimbs}
          focusStop={selectedStop}
          onClimbSelect={(climbId) => {
            const climb = bundle.climbs?.find((item) => item.id === climbId) ?? null;
            setSelectedClimb(climb);
          }}
          discoverCandidates={discovery.candidates}
          selectedDiscoverKey={discovery.selectedCandidateKey}
          onDiscoverBoundsChange={discovery.handleBoundsChange}
          onSelectDiscoverCandidate={(candidate) => discovery.openCandidate(candidate)}
        />

        {!selectedStop ? (
          <>
            <div className="pointer-events-none absolute left-3 top-3 z-10">
              <label className="pointer-events-auto flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs text-white/80 backdrop-blur-xl">
                <input
                  type="checkbox"
                  checked={showUnverified}
                  onChange={(event) => setShowUnverified(event.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-violet-500"
                />
                Suggested stops
              </label>
            </div>

            <MapControls
              followGps={followGps}
              gpsActive={gpsActive}
              onRecenter={() => mapRef.current?.recenter()}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onResetNorth={() => mapRef.current?.resetNorth()}
            />

            <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-20">
              <DiscoverStopsControls
                loading={discovery.loading}
                resultMessage={discovery.resultMessage}
                onFindStops={discovery.findStops}
              />
            </div>
          </>
        ) : null}
      </div>

      <StopSheet
        stop={selectedStop}
        bundle={bundle}
        onClose={handleStopSheetClose}
        onSelectAlternative={selectStop}
        onVerified={handleStopVerified}
        onSkipped={handleStopSkipped}
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
