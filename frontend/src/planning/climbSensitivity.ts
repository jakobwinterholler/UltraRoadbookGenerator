import type { ClimbDetectionConfig } from "./types";
import { DEFAULT_CLIMB_CONFIG } from "./types";

export type ClimbSensitivity = "very_low" | "low" | "normal" | "high" | "very_high";

export const CLIMB_SENSITIVITY_OPTIONS: { id: ClimbSensitivity; label: string }[] = [
  { id: "very_low", label: "Very Low" },
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "very_high", label: "Very High" },
];

const SENSITIVITY_CONFIGS: Record<ClimbSensitivity, ClimbDetectionConfig> = {
  very_low: {
    smoothing_window_m: 80,
    rolling_gradient_window_m: 100,
    gradient_threshold_pct: 1.6,
    meaningful_descent_threshold_m: 60,
    min_elevation_gain_m: 80,
    min_average_gradient_pct: 4.5,
  },
  low: {
    smoothing_window_m: 70,
    rolling_gradient_window_m: 100,
    gradient_threshold_pct: 1.3,
    meaningful_descent_threshold_m: 55,
    min_elevation_gain_m: 65,
    min_average_gradient_pct: 3.8,
  },
  normal: DEFAULT_CLIMB_CONFIG,
  high: {
    smoothing_window_m: 50,
    rolling_gradient_window_m: 100,
    gradient_threshold_pct: 0.8,
    meaningful_descent_threshold_m: 45,
    min_elevation_gain_m: 40,
    min_average_gradient_pct: 2.5,
  },
  very_high: {
    smoothing_window_m: 40,
    rolling_gradient_window_m: 100,
    gradient_threshold_pct: 0.6,
    meaningful_descent_threshold_m: 40,
    min_elevation_gain_m: 30,
    min_average_gradient_pct: 2.0,
  },
};

export function climbConfigForSensitivity(sensitivity: ClimbSensitivity): ClimbDetectionConfig {
  return { ...SENSITIVITY_CONFIGS[sensitivity] };
}

export function sensitivityForClimbConfig(config: ClimbDetectionConfig): ClimbSensitivity {
  for (const option of CLIMB_SENSITIVITY_OPTIONS) {
    const candidate = SENSITIVITY_CONFIGS[option.id];
    const matches = (
      Object.keys(candidate) as (keyof ClimbDetectionConfig)[]
    ).every((key) => candidate[key] === config[key]);
    if (matches) {
      return option.id;
    }
  }
  return "normal";
}

export const DEFAULT_CLIMB_SENSITIVITY: ClimbSensitivity = "normal";
