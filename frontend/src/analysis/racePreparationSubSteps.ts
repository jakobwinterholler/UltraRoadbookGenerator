import type { AnalysisState, PipelineStepState } from "./analysisState";
import type { RacePreparationStepId, RacePreparationStepStatus } from "./racePreparationSteps";

export interface RacePreparationSubStepView {
  id: string;
  label: string;
  status: RacePreparationStepStatus;
  detail: string | null;
}

interface SubStepDefinition {
  id: string;
  label: string;
  resolve: (state: AnalysisState) => RacePreparationStepStatus;
  detail?: (state: AnalysisState) => string | null;
}

function stepState(state: AnalysisState, stepId: string): PipelineStepState | null {
  return state.pipelineSteps[stepId] ?? null;
}

function stepComplete(state: AnalysisState, stepId: string): boolean {
  return stepState(state, stepId)?.status === "complete";
}

function stepActive(state: AnalysisState, stepId: string): boolean {
  return stepState(state, stepId)?.status === "active";
}

function hasLog(state: AnalysisState, needle: string): boolean {
  return state.logs.some((entry) => entry.message.toLowerCase().includes(needle.toLowerCase()));
}

function subprogressLabel(state: AnalysisState): string | null {
  return state.subprogress?.label ?? null;
}

function subprogressDetail(state: AnalysisState): string | null {
  if (!state.subprogress || state.subprogress.total <= 1) {
    return null;
  }
  return `${state.subprogress.current.toLocaleString()} / ${state.subprogress.total.toLocaleString()}`;
}

function osmCacheLabel(step: PipelineStepState | null): string {
  if (!step) {
    return "Cache loaded";
  }
  const label = step.label.toLowerCase();
  if (label.includes("geometry cache")) {
    return "Geometry cache loaded";
  }
  if (label.includes("cached") || label.includes("cache")) {
    return "Cache loaded";
  }
  if (label.includes("download")) {
    return "OSM data downloaded";
  }
  return "OpenStreetMap ready";
}

const SURFACE_SUBSTEPS: SubStepDefinition[] = [
  {
    id: "load_osm",
    label: "Loading OpenStreetMap",
    resolve: (state) => {
      if (stepComplete(state, "osm_surface_data")) {
        return "ready";
      }
      if (stepActive(state, "osm_surface_data")) {
        return "running";
      }
      if (stepComplete(state, "reading_gpx") || state.readiness.map === "ready") {
        return "running";
      }
      return "waiting";
    },
    detail: (state) => stepState(state, "osm_surface_data")?.label ?? null,
  },
  {
    id: "osm_ready",
    label: "Cache loaded",
    resolve: (state) => (stepComplete(state, "osm_surface_data") ? "ready" : "waiting"),
    detail: (state) => {
      const step = stepState(state, "osm_surface_data");
      return step?.status === "complete" ? osmCacheLabel(step) : null;
    },
  },
  {
    id: "parse_roads",
    label: "Parsing roads",
    resolve: (state) => {
      if (hasLog(state, "parsed osm roads") || hasLog(state, "geometry cache")) {
        return "ready";
      }
      const label = subprogressLabel(state);
      if (label === "Parsing roads") {
        return "running";
      }
      if (
        stepActive(state, "detecting_surfaces") &&
        label !== "Matching route segments" &&
        label !== "Surface inference" &&
        label !== "Merging surface segments"
      ) {
        return "running";
      }
      if (
        stepComplete(state, "detecting_surfaces") ||
        label === "Matching route segments" ||
        label === "Surface inference" ||
        label === "Merging surface segments"
      ) {
        return "ready";
      }
      return stepComplete(state, "osm_surface_data") ? "waiting" : "waiting";
    },
  },
  {
    id: "match_gpx",
    label: "Matching GPX to roads",
    resolve: (state) => {
      const label = subprogressLabel(state);
      if (stepComplete(state, "detecting_surfaces") || state.readiness.surface === "ready") {
        return "ready";
      }
      if (label === "Matching route segments") {
        return "running";
      }
      if (
        label === "Surface inference" ||
        label === "Merging surface segments" ||
        hasLog(state, "running surface inference")
      ) {
        return "ready";
      }
      return "waiting";
    },
    detail: (state) =>
      subprogressLabel(state) === "Matching route segments" ? subprogressDetail(state) : null,
  },
  {
    id: "surface_inference",
    label: "Surface inference",
    resolve: (state) => {
      if (stepComplete(state, "detecting_surfaces") || state.readiness.surface === "ready") {
        return "ready";
      }
      const label = subprogressLabel(state);
      if (label === "Surface inference" || label === "Merging surface segments") {
        return "running";
      }
      return "waiting";
    },
    detail: (state) => {
      const label = subprogressLabel(state);
      if (label === "Merging surface segments") {
        return "Merging surface segments";
      }
      return null;
    },
  },
];

const RESUPPLY_SUBSTEPS: SubStepDefinition[] = [
  {
    id: "load_poi_osm",
    label: "Loading resupply data",
    resolve: (state) => {
      if (stepComplete(state, "osm_poi_data")) {
        return "ready";
      }
      if (stepActive(state, "osm_poi_data")) {
        return "running";
      }
      if (state.readiness.surface === "ready") {
        return "running";
      }
      return "waiting";
    },
    detail: (state) => stepState(state, "osm_poi_data")?.label ?? null,
  },
  {
    id: "poi_cache",
    label: "Cache loaded",
    resolve: (state) => (stepComplete(state, "osm_poi_data") ? "ready" : "waiting"),
    detail: (state) => {
      const step = stepState(state, "osm_poi_data");
      return step?.status === "complete" ? osmCacheLabel(step) : null;
    },
  },
  {
    id: "match_pois",
    label: "Finding resupply locations",
    resolve: (state) => {
      if (state.readiness.pois === "ready" || stepComplete(state, "finding_pois")) {
        return "ready";
      }
      if (stepActive(state, "finding_pois") || subprogressLabel(state) === "Processing POIs") {
        return "running";
      }
      return stepComplete(state, "osm_poi_data") ? "waiting" : "waiting";
    },
    detail: (state) =>
      subprogressLabel(state) === "Processing POIs" ? subprogressDetail(state) : null,
  },
];

const SUBSTEP_DEFINITIONS: Partial<Record<RacePreparationStepId, SubStepDefinition[]>> = {
  surface_analysis: SURFACE_SUBSTEPS,
  finding_resupply: RESUPPLY_SUBSTEPS,
};

export function deriveRacePreparationSubSteps(
  stepId: RacePreparationStepId,
  state: AnalysisState,
): RacePreparationSubStepView[] {
  const definitions = SUBSTEP_DEFINITIONS[stepId];
  if (!definitions) {
    return [];
  }

  let foundRunning = false;

  return definitions.map((definition) => {
    let status = definition.resolve(state);

    if (status === "running") {
      foundRunning = true;
    } else if (!foundRunning && status === "waiting") {
      const priorReady = definitions
        .slice(0, definitions.indexOf(definition))
        .every((item) => item.resolve(state) === "ready");
      if (priorReady && status === "waiting") {
        status = "running";
        foundRunning = true;
      }
    }

    return {
      id: definition.id,
      label:
        definition.id === "osm_ready" && status === "ready"
          ? osmCacheLabel(stepState(state, "osm_surface_data"))
          : definition.id === "poi_cache" && status === "ready"
            ? osmCacheLabel(stepState(state, "osm_poi_data"))
            : definition.label,
      status,
      detail: definition.detail?.(state) ?? null,
    };
  });
}

export function hasGranularSubSteps(stepId: RacePreparationStepId): boolean {
  return stepId in SUBSTEP_DEFINITIONS;
}
