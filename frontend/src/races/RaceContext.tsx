import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RoadbookResult } from "../api";
import { resetRaceOpenTrace, raceOpenTrace } from "../debug/raceOpenTrace";
import {
  fetchRaceDetail,
  fetchRaceRoadbook,
  fetchRaces,
  updateRacePreparation,
  type PreparationMilestoneId,
  type RaceSummary,
  type VerifiedStopRecord,
} from "./api";

interface RaceContextValue {
  races: RaceSummary[];
  activeRace: RaceSummary | null;
  activeRaceId: string | null;
  roadbook: RoadbookResult | null;
  verifiedStops: Record<string, VerifiedStopRecord>;
  loadingRaces: boolean;
  loadingRoadbook: boolean;
  error: string | null;
  refreshRaces: () => Promise<void>;
  openRace: (raceId: string) => Promise<RaceSummary>;
  closeRace: () => void;
  setActiveRaceSummary: (summary: RaceSummary) => void;
  markPreparation: (milestone: PreparationMilestoneId, complete?: boolean) => Promise<void>;
  saveVerifiedStop: (zoneId: number, record: VerifiedStopRecord) => Promise<void>;
  setRoadbook: React.Dispatch<React.SetStateAction<RoadbookResult | null>>;
}

const RaceContext = createContext<RaceContextValue | null>(null);

export function useRace(): RaceContextValue {
  const context = useContext(RaceContext);
  if (!context) {
    throw new Error("useRace must be used within RaceProvider");
  }
  return context;
}

export function RaceProvider({ children }: { children: ReactNode }) {
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);
  const [activeRace, setActiveRace] = useState<RaceSummary | null>(null);
  const [roadbook, setRoadbook] = useState<RoadbookResult | null>(null);
  const [verifiedStops, setVerifiedStops] = useState<Record<string, VerifiedStopRecord>>({});
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [loadingRoadbook, setLoadingRoadbook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRaces = useCallback(async () => {
    setLoadingRaces(true);
    setError(null);
    try {
      const next = await fetchRaces();
      setRaces(next);
      if (activeRaceId) {
        const updated = next.find((race) => race.id === activeRaceId);
        if (updated) {
          setActiveRace(updated);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load races.");
    } finally {
      setLoadingRaces(false);
    }
  }, [activeRaceId]);

  const openRace = useCallback(async (raceId: string) => {
    resetRaceOpenTrace(raceId);
    setLoadingRoadbook(true);
    setError(null);
    try {
      raceOpenTrace("open_race.fetch_detail.start", { raceId });
      const detail = await fetchRaceDetail(raceId);
      raceOpenTrace("open_race.fetch_detail.done", {
        raceId,
        detail: `has_analysis=${detail.race.has_analysis}`,
      });
      setActiveRaceId(raceId);
      setActiveRace(detail.race);
      setVerifiedStops(detail.preparation.verified_stops ?? {});

      if (detail.race.has_analysis) {
        const data = await fetchRaceRoadbook(raceId);
        setRoadbook(data);
      } else {
        setRoadbook(null);
      }

      void refreshRaces();
      raceOpenTrace("open_race.done", {
        raceId,
        detail: detail.race.has_analysis ? "roadbook loaded" : "no analysis yet",
      });
      return detail.race;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open race.";
      raceOpenTrace("open_race.error", { raceId, detail: message });
      setError(message);
      throw err;
    } finally {
      setLoadingRoadbook(false);
    }
  }, [refreshRaces]);

  const closeRace = useCallback(() => {
    setActiveRaceId(null);
    setActiveRace(null);
    setRoadbook(null);
    setVerifiedStops({});
  }, []);

  const setActiveRaceSummary = useCallback((summary: RaceSummary) => {
    setActiveRace(summary);
    setRaces((current) => current.map((race) => (race.id === summary.id ? summary : race)));
  }, []);

  const markPreparation = useCallback(
    async (milestone: PreparationMilestoneId, complete = true) => {
      if (!activeRaceId) {
        return;
      }
      const result = await updateRacePreparation(activeRaceId, {
        progress: { [milestone]: complete },
      });
      setActiveRaceSummary(result.race);
      setVerifiedStops(result.preparation.verified_stops ?? {});
    },
    [activeRaceId, setActiveRaceSummary],
  );

  const saveVerifiedStop = useCallback(
    async (zoneId: number, record: VerifiedStopRecord) => {
      if (!activeRaceId) {
        return;
      }
      const key = String(zoneId);
      setVerifiedStops((current) => ({ ...current, [key]: record }));
      const result = await updateRacePreparation(activeRaceId, {
        verifiedStops: { [key]: record },
      });
      setVerifiedStops(result.preparation.verified_stops ?? {});
      setActiveRaceSummary(result.race);
    },
    [activeRaceId, setActiveRaceSummary],
  );

  const value = useMemo(
    () => ({
      races,
      activeRace,
      activeRaceId,
      roadbook,
      verifiedStops,
      loadingRaces,
      loadingRoadbook,
      error,
      refreshRaces,
      openRace,
      closeRace,
      setActiveRaceSummary,
      markPreparation,
      saveVerifiedStop,
      setRoadbook,
    }),
    [
      races,
      activeRace,
      activeRaceId,
      roadbook,
      verifiedStops,
      loadingRaces,
      loadingRoadbook,
      error,
      refreshRaces,
      openRace,
      closeRace,
      setActiveRaceSummary,
      markPreparation,
      saveVerifiedStop,
    ],
  );

  return <RaceContext.Provider value={value}>{children}</RaceContext.Provider>;
}
