import { createContext, useContext } from "react";
import type { RouteTrack } from "@shared/race/mapMatching";
import type { CompanionBundle, CompanionStop } from "../types";
import type { RaceGpsState } from "../lib/useRaceGps";

export interface CompanionContextValue {
  bundle: CompanionBundle;
  currentKm: number;
  gps: RaceGpsState;
  routeTrack: RouteTrack | null;
  selectedStop: CompanionStop | null;
  selectStop: (stop: CompanionStop | null) => void;
  showUnverified: boolean;
  setShowUnverified: (value: boolean) => void;
  followGps: boolean;
  setFollowGps: (value: boolean) => void;
  updateBundle: (bundle: CompanionBundle) => void;
  clearRace: () => Promise<void>;
}

export const CompanionContext = createContext<CompanionContextValue | null>(null);

export function useCompanion(): CompanionContextValue {
  const value = useContext(CompanionContext);
  if (!value) {
    throw new Error("useCompanion must be used within CompanionProvider");
  }
  return value;
}
