import { useCallback, useMemo, useState } from "react";
import { collectAllBundlePois } from "@shared/race/bundlePois";
import { discoverStopIcon, poiOsmKey, type DiscoverCandidate, type MapBounds } from "@shared/race/discoverStops";
import type { CompanionBundle, CompanionStop } from "@shared/types/sync";
import {
  discoverPoisFromBundle,
  discoverStopsCache,
  primaryPoiKeysFromBundle,
  trackPointsFromBundle,
} from "./discoverStopsAdapter";

interface UseDiscoverStopsOptions {
  bundle: CompanionBundle;
  onSelectStop: (stop: CompanionStop) => void;
}

function candidateToCompanionStop(
  bundle: CompanionBundle,
  candidate: DiscoverCandidate,
): CompanionStop | null {
  const match = collectAllBundlePois(bundle).find(
    (entry) =>
      entry.stop.osmId === candidate.osmId && entry.stop.osmType === candidate.osmType,
  );
  if (match) {
    return match.stop;
  }

  const zoneId = candidate.zoneId ?? bundle.stops[0]?.zoneId;
  if (zoneId == null) {
    return null;
  }

  return {
    zoneId,
    osmId: candidate.osmId,
    osmType: candidate.osmType,
    km: candidate.distanceAlongKm,
    lat: candidate.lat,
    lon: candidate.lon,
    name: candidate.name?.trim() || candidate.brand?.trim() || "Resupply",
    category: candidate.category,
    categoryLabel: candidate.category,
    icon: candidate.icon || discoverStopIcon(candidate.category),
    distanceOffRouteM: candidate.distanceOffRouteM,
    confidenceScore: candidate.score,
    verificationStatus: "unverified",
    openingHours: candidate.openingHours ?? null,
    notes: null,
    hasFood: candidate.services.includes("Food"),
    hasWater: candidate.services.includes("Water"),
    hasFuel: candidate.services.includes("Fuel"),
    hasCoffee: candidate.category === "Café" || candidate.category === "Restaurant",
  };
}

export function useDiscoverStops({ bundle, onSelectStop }: UseDiscoverStopsOptions) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());
  const [promoting, setPromoting] = useState(false);

  const discoverInputs = useMemo(() => discoverPoisFromBundle(bundle), [bundle]);
  const trackInputs = useMemo(() => trackPointsFromBundle(bundle), [bundle]);
  const existingStopKms = useMemo(() => bundle.stops.map((stop) => stop.km), [bundle.stops]);
  const primaryKeys = useMemo(() => primaryPoiKeysFromBundle(bundle), [bundle]);

  const runDiscovery = useCallback(
    (nextBounds: MapBounds) => {
      setLoading(true);
      const result = discoverStopsCache.resolve({
        pois: discoverInputs,
        bounds: nextBounds,
        trackPoints: trackInputs,
        existingStopKms,
        primaryPoiKeys: primaryKeys,
        dismissedPoiKeys: dismissedKeys,
        limit: 8,
      });
      setCandidates(result.candidates);
      setLoading(false);
    },
    [discoverInputs, dismissedKeys, existingStopKms, primaryKeys, trackInputs],
  );

  const handleBoundsChange = useCallback(
    (nextBounds: MapBounds) => {
      setBounds(nextBounds);
      if (active) {
        runDiscovery(nextBounds);
      }
    },
    [active, runDiscovery],
  );

  const toggleDiscovery = useCallback(() => {
    setActive((current) => {
      const next = !current;
      if (!next) {
        setCandidates([]);
        setSelectedCandidateKey(null);
      } else if (bounds) {
        runDiscovery(bounds);
      }
      return next;
    });
  }, [bounds, runDiscovery]);

  const selectedCandidate = useMemo(
    () =>
      candidates.find(
        (candidate) => poiOsmKey(candidate.osmType, candidate.osmId) === selectedCandidateKey,
      ) ?? null,
    [candidates, selectedCandidateKey],
  );

  const dismissCandidate = useCallback(
    (candidate: DiscoverCandidate) => {
      const key = poiOsmKey(candidate.osmType, candidate.osmId);
      setDismissedKeys((current) => new Set([...current, key]));
      setCandidates((current) =>
        current.filter((item) => poiOsmKey(item.osmType, item.osmId) !== key),
      );
      setSelectedCandidateKey((current) => (current === key ? null : current));
      if (bounds) {
        discoverStopsCache.clear();
        runDiscovery(bounds);
      }
    },
    [bounds, runDiscovery],
  );

  const promoteCandidate = useCallback(
    async (candidate: DiscoverCandidate) => {
      setPromoting(true);
      try {
        const stop = candidateToCompanionStop(bundle, candidate);
        if (stop) {
          onSelectStop(stop);
        }
        dismissCandidate(candidate);
        setActive(false);
        setCandidates([]);
        setSelectedCandidateKey(null);
      } finally {
        setPromoting(false);
      }
    },
    [bundle, dismissCandidate, onSelectStop],
  );

  return {
    active,
    loading,
    candidates,
    selectedCandidate,
    selectedCandidateKey,
    promoting,
    toggleDiscovery,
    handleBoundsChange,
    selectCandidate: setSelectedCandidateKey,
    dismissCandidate,
    promoteCandidate,
  };
}
