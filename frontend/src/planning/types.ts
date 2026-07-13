import type { RouteVisualization } from "../api";

export type OverlayMode = "normal" | "surface" | "resupply";
export type TimeMode = "day" | "night";
export type ZoneDensityMode = "detailed" | "balanced" | "planning" | "minimal";

export type { TimeWindowId } from "./timeWindows";

export type ResupplyCategoryFilter = "food" | "water" | "fuel" | "dining";
export type DetourFilter =
  | "on_route"
  | "very_small"
  | "small"
  | "medium"
  | "large";

export type ResupplySortMode =
  | "along_route"
  | "best_reliability"
  | "closest_to_route"
  | "least_detour";

export interface StagePlanningSettings {
  preferredStageLengthKm: number;
  maxGapWithoutResupplyKm: number;
}

export interface ClimbDetectionConfig {
  smoothing_window_m: number;
  rolling_gradient_window_m: number;
  gradient_threshold_pct: number;
  meaningful_descent_threshold_m: number;
  min_elevation_gain_m: number;
  min_average_gradient_pct: number;
}

export interface ResupplyPageFilters {
  categories: ResupplyCategoryFilter[];
  timeMode: TimeMode | "all";
  detourBands: DetourFilter[];
}

export interface LegendItem {
  label: string;
  color: string;
}

export interface ColoredRouteSegment {
  start_km: number;
  end_km: number;
  color: string;
  label?: string;
}

export const DEFAULT_STAGE_SETTINGS: StagePlanningSettings = {
  preferredStageLengthKm: 75,
  maxGapWithoutResupplyKm: 50,
};

export const DEFAULT_CLIMB_CONFIG: ClimbDetectionConfig = {
  smoothing_window_m: 60,
  rolling_gradient_window_m: 100,
  gradient_threshold_pct: 1.0,
  meaningful_descent_threshold_m: 50,
  min_elevation_gain_m: 50,
  min_average_gradient_pct: 3.0,
};

export const DEFAULT_RESUPPLY_FILTERS: ResupplyPageFilters = {
  categories: [],
  timeMode: "all",
  detourBands: [],
};

export interface PlanningViewContext {
  overlay: OverlayMode;
  timeMode: TimeMode;
  zoneDensity: ZoneDensityMode;
  stageSettings: StagePlanningSettings;
}

export interface RouteSegmentSource {
  route: RouteVisualization;
  overlay: OverlayMode;
}
