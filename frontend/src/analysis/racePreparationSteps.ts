import type { AnalysisState, ReadinessSlice, ReadinessStatus } from "./analysisState";

export type RacePreparationStepId =
  | "gpx_imported"
  | "route_geometry"
  | "detecting_climbs"
  | "surface_analysis"
  | "finding_resupply"
  | "unsupported_sections"
  | "finalizing";

export interface RacePreparationStepDefinition {
  id: RacePreparationStepId;
  label: string;
  /** Readiness slices that must be ready for this step to complete. */
  slices: ReadinessSlice[];
  /** Pipeline stage ids that indicate this step is actively running. */
  stageIds: string[];
}

export const RACE_PREPARATION_STEPS: RacePreparationStepDefinition[] = [
  {
    id: "gpx_imported",
    label: "GPX imported",
    slices: ["distance", "elevation"],
    stageIds: ["reading_gpx", "calculating_distance"],
  },
  {
    id: "route_geometry",
    label: "Route geometry",
    slices: ["map"],
    stageIds: ["generate_map", "calculating_distance"],
  },
  {
    id: "detecting_climbs",
    label: "Detecting climbs",
    slices: ["climbs"],
    stageIds: ["detecting_climbs", "calculating_gradients"],
  },
  {
    id: "surface_analysis",
    label: "Surface analysis",
    slices: ["surface"],
    stageIds: ["osm_surface_data", "detecting_surfaces"],
  },
  {
    id: "finding_resupply",
    label: "Finding resupply points",
    slices: ["pois"],
    stageIds: ["osm_poi_data", "finding_pois"],
  },
  {
    id: "unsupported_sections",
    label: "Building unsupported sections",
    slices: ["resupply"],
    stageIds: ["creating_resupply_zones", "calculating_resupply_quality"],
  },
  {
    id: "finalizing",
    label: "Finalizing race",
    slices: ["timeline"],
    stageIds: ["generating_route_visualization", "preparing_dashboard"],
  },
];

export type RacePreparationStepStatus = "waiting" | "running" | "ready";

export interface RacePreparationStepView {
  id: RacePreparationStepId;
  label: string;
  status: RacePreparationStepStatus;
  hint: string | null;
}

function slicesReady(
  readiness: Record<ReadinessSlice, ReadinessStatus>,
  slices: ReadinessSlice[],
): boolean {
  return slices.every((slice) => readiness[slice] === "ready");
}

function slicesRunning(
  readiness: Record<ReadinessSlice, ReadinessStatus>,
  slices: ReadinessSlice[],
): boolean {
  return slices.some((slice) => readiness[slice] === "running");
}

function hintForStage(stageId: string | null, state: AnalysisState): string | null {
  if (!stageId) {
    return null;
  }

  const hints: Record<string, string> = {
    reading_gpx: "Reading your GPX file…",
    calculating_distance: "Calculating distance and elevation…",
    generate_map: "Drawing the route on the map…",
    osm_surface_data: "Downloading OpenStreetMap surface data…",
    detecting_surfaces: "Matching your GPX against OpenStreetMap…",
    osm_poi_data: "Downloading resupply data from OpenStreetMap…",
    finding_pois: "Finding reliable resupply locations…",
    creating_resupply_zones: "Grouping stops into resupply zones…",
    calculating_resupply_quality: "Scoring resupply reliability along the route…",
    detecting_climbs: "Finding climbs along the route…",
    calculating_gradients: "Calculating climb gradients…",
    generating_route_visualization: "Building the route timeline…",
    preparing_dashboard: "Preparing your race dashboard…",
  };

  if (hints[stageId]) {
    return hints[stageId];
  }

  if (state.subprogress?.label) {
    return state.subprogress.label;
  }

  if (state.currentLabel && state.currentLabel !== "Starting analysis…") {
    return state.currentLabel;
  }

  return null;
}

const FALLBACK_HINTS: Partial<Record<RacePreparationStepId, string>> = {
  gpx_imported: "Reading your GPX file…",
  route_geometry: "Building the route map…",
  detecting_climbs: "Finding climbs along the route…",
  surface_analysis: "Matching your GPX against OpenStreetMap…",
  finding_resupply: "Finding reliable resupply locations…",
  unsupported_sections: "Identifying difficult self-supported sections…",
  finalizing: "Preparing your race workspace…",
};

function hintForRunningStep(
  definition: RacePreparationStepDefinition,
  state: AnalysisState,
): string | null {
  if (state.stageId && definition.stageIds.includes(state.stageId)) {
    return hintForStage(state.stageId, state);
  }
  if (state.subprogress?.label) {
    return state.subprogress.label;
  }
  return FALLBACK_HINTS[definition.id] ?? state.currentLabel ?? null;
}

export function deriveRacePreparationSteps(state: AnalysisState): RacePreparationStepView[] {
  const { readiness, stageId } = state;
  const views: RacePreparationStepView[] = [];
  let foundRunning = false;

  for (const definition of RACE_PREPARATION_STEPS) {
    let status: RacePreparationStepStatus = "waiting";

    if (slicesReady(readiness, definition.slices)) {
      status = "ready";
    } else if (
      !foundRunning &&
      (slicesRunning(readiness, definition.slices) ||
        (stageId !== null && definition.stageIds.includes(stageId)))
    ) {
      status = "running";
      foundRunning = true;
    } else if (!foundRunning) {
      const priorReady = RACE_PREPARATION_STEPS.slice(
        0,
        RACE_PREPARATION_STEPS.indexOf(definition),
      ).every((step) => slicesReady(readiness, step.slices));

      if (priorReady && definition.slices.some((slice) => readiness[slice] !== "waiting")) {
        status = "running";
        foundRunning = true;
      }
    }

    const hint =
      status === "running" ? hintForRunningStep(definition, state) : null;

    views.push({
      id: definition.id,
      label: definition.label,
      status,
      hint,
    });
  }

  const hasRunning = views.some((step) => step.status === "running");
  if (!hasRunning && state.percent < 100 && !state.error) {
    const nextIndex = views.findIndex((step) => step.status !== "ready");
    if (nextIndex >= 0) {
      const definition = RACE_PREPARATION_STEPS[nextIndex];
      views[nextIndex] = {
        ...views[nextIndex],
        status: "running",
        hint: hintForRunningStep(definition, state),
      };
    }
  }

  return views;
}

export function preparationPercent(state: AnalysisState): number {
  return Math.min(100, Math.max(0, Math.round(state.percent)));
}
