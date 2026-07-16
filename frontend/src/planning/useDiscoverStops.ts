import { useCallback, useMemo, useState } from "react";
import type { PoiRow, ResupplyZone, TrackPoint } from "../api";
import {
  poiOsmKey,
  type DiscoverCandidate,
  type MapBounds,
} from "@shared/race/discoverStops";
import { findZoneForPoi, poiKey, type StopSelection } from "./stopSelection";
import {
  discoverStopsCache,
  poiRowToDiscoverInput,
  primaryPoiKeysFromZones,
  trackPointToDiscoverInput,
} from "./discoverStopsAdapter";
import type { VerifiedStopRecord } from "./stopVerification/types";

interface UseDiscoverStopsOptions {
  pois: PoiRow[];
  trackPoints: TrackPoint[];
  presentedZones: ResupplyZone[];
  onSelectPoi: (selection: StopSelection) => void;
  onPromoteVerified?: (zoneId: number, poi: PoiRow) => Promise<void>;
}

export function useDiscoverStops({
  pois,
  trackPoints,
  presentedZones,
  onSelectPoi,
  onPromoteVerified,
}: UseDiscoverStopsOptions) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());
  const [promoting, setPromoting] = useState(false);

  const discoverInputs = useMemo(() => pois.map(poiRowToDiscoverInput), [pois]);
  const trackInputs = useMemo(
    () => trackPoints.map(trackPointToDiscoverInput),
    [trackPoints],
  );
  const existingStopKms = useMemo(
    () => presentedZones.map((zone) => zone.distance_along_km),
    [presentedZones],
  );
  const primaryKeys = useMemo(
    () => primaryPoiKeysFromZones(presentedZones),
    [presentedZones],
  );

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
        const poiRow = pois.find(
          (poi) => poi.osm_id === candidate.osmId && poi.osm_type === candidate.osmType,
        );
        if (!poiRow) {
          return;
        }
        const zone =
          findZoneForPoi(presentedZones, poiRow) ??
          (poiRow.zone_id != null
            ? presentedZones.find((entry) => entry.zone_id === poiRow.zone_id) ?? null
            : null);

        onSelectPoi({ kind: "poi", poi: poiRow, zone });

        if (zone && onPromoteVerified) {
          await onPromoteVerified(zone.zone_id, poiRow);
        }

        dismissCandidate(candidate);
        setActive(false);
        setCandidates([]);
        setSelectedCandidateKey(null);
      } finally {
        setPromoting(false);
      }
    },
    [dismissCandidate, onPromoteVerified, onSelectPoi, pois, presentedZones],
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

export function buildPromoteRecord(poi: PoiRow): VerifiedStopRecord {
  return {
    status: "verified",
    poiKey: poiKey(poi),
    updatedAt: new Date().toISOString(),
  };
}
