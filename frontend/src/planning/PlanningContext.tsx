import { createContext, useContext, type ReactNode } from "react";
import type { TimelineLayers } from "./timelineLayers";
import { DEFAULT_TIMELINE_LAYERS } from "./timelineLayers";
import type {
  OverlayMode,
  ResupplyPageFilters,
  ResupplySortMode,
  TimeMode,
  ZoneDensityMode,
} from "./types";
import { DEFAULT_RESUPPLY_FILTERS } from "./types";
import type { PlanningIntent } from "./planningIntent";

/** Session view state — controls you change frequently while exploring. */
export interface PlanningContextValue {
  overlay: OverlayMode;
  setOverlay: (overlay: OverlayMode) => void;
  /** Fixed to day in the UI for now; night filtering remains available for a future stage planner. */
  timeMode: TimeMode;
  setTimeMode: (mode: TimeMode) => void;
  zoneDensity: ZoneDensityMode;
  setZoneDensity: (mode: ZoneDensityMode) => void;
  resupplyFilters: ResupplyPageFilters;
  setResupplyFilters: (filters: ResupplyPageFilters) => void;
  resupplySort: ResupplySortMode;
  setResupplySort: (sort: ResupplySortMode) => void;
  timelineLayers: TimelineLayers;
  setTimelineLayers: (layers: TimelineLayers) => void;
  selectedSurfaceType: string | null;
  setSelectedSurfaceType: (surface: string | null) => void;
  planningIntent: PlanningIntent;
  setPlanningIntent: (intent: PlanningIntent) => void;
  consumePlanningIntent: () => void;
}

export const PlanningContext = createContext<PlanningContextValue | null>(null);

export function usePlanning(): PlanningContextValue {
  const context = useContext(PlanningContext);
  if (!context) {
    throw new Error("usePlanning must be used within PlanningProvider");
  }
  return context;
}

export const planningDefaults = {
  overlay: "resupply" as OverlayMode,
  timeMode: "day" as TimeMode,
  zoneDensity: "planning" as ZoneDensityMode,
  resupplyFilters: DEFAULT_RESUPPLY_FILTERS,
  resupplySort: "along_route" as ResupplySortMode,
  timelineLayers: DEFAULT_TIMELINE_LAYERS,
  selectedSurfaceType: null as string | null,
  planningIntent: null as PlanningIntent,
};

export function PlanningProvider({
  value,
  children,
}: {
  value: PlanningContextValue;
  children: ReactNode;
}) {
  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}
