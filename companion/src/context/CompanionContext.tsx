import { createContext, useContext } from "react";
import type { CompanionBundle, CompanionStop } from "../types";

export interface CompanionContextValue {
  bundle: CompanionBundle;
  currentKm: number;
  setCurrentKm: (km: number) => void;
  selectedStop: CompanionStop | null;
  selectStop: (stop: CompanionStop | null) => void;
  showUnverified: boolean;
  setShowUnverified: (value: boolean) => void;
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
