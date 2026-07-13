import { useSettings } from "../settings/SettingsContext";

export function usePlanningAssumptions() {
  const { settings } = useSettings();

  const planning = settings?.planning;

  return {
    arrivalTimeWindow: planning?.default_arrival_time_window ?? null,
    stageSettings: {
      preferredStageLengthKm: planning?.preferred_stage_length_km ?? 75,
      maxGapWithoutResupplyKm: planning?.max_gap_without_resupply_km ?? 50,
    },
    climbConfig: planning?.climb_config ?? null,
    climbSensitivity: planning?.climb_sensitivity ?? "normal",
  };
}
