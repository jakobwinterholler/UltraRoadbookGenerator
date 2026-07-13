import {
  createEmptyLivePreview,
  type AnalysisLivePreview,
  type LiveClimb,
  type LiveSurfaceSegment,
  type LiveTrackPoint,
} from "./liveMapUtils";

import type { PerformanceStageRow, PerformanceSummaryRow } from "../api";

export type PipelineStepStatus = "active" | "complete" | "error";

export interface PipelineStepState {
  status: PipelineStepStatus;
  label: string;
  detail: string | null;
}

export type ReadinessSlice =
  | "distance"
  | "elevation"
  | "map"
  | "climbs"
  | "surface"
  | "pois"
  | "resupply"
  | "timeline";

export type ReadinessStatus = "waiting" | "running" | "ready";

export interface AnalysisStats {
  distance_km: number | null;
  elevation_gain_m: number | null;
  gpx_points: number | null;
  climb_count: number | null;
  surface_pct: number | null;
  asphalt_pct: number | null;
  gravel_pct: number | null;
  poi_count: number | null;
  zone_count: number | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string | null;
}

export interface LogEntry {
  id: string;
  message: string;
  at: number;
}

export interface AnalysisState {
  percent: number;
  currentLabel: string;
  stageId: string | null;
  subprogress: { label: string; current: number; total: number } | null;
  stats: AnalysisStats;
  readiness: Record<ReadinessSlice, ReadinessStatus>;
  checklist: ChecklistItem[];
  logs: LogEntry[];
  routePreview: {
    track_points: Array<{ lat: number; lon: number }>;
    bounds: { south: number; west: number; north: number; east: number };
  } | null;
  livePreview: AnalysisLivePreview;
  routeName: string | null;
  error: string | null;
  lastEventAt: number;
  pipelineSteps: Record<string, PipelineStepState>;
  performanceReport: PerformanceStageRow[];
  performanceSummary: PerformanceSummaryRow | null;
}

export const CHECKLIST_DEFINITIONS: Array<{ id: string; label: string; slices: ReadinessSlice[] }> = [
  { id: "reading_gpx", label: "Read GPX", slices: [] },
  { id: "calculating_distance", label: "Parse geometry", slices: ["distance", "elevation"] },
  { id: "generate_map", label: "Generate map", slices: ["map"] },
  { id: "detecting_climbs", label: "Detect climbs", slices: ["climbs"] },
  { id: "detecting_surfaces", label: "Detect surfaces", slices: ["surface"] },
  { id: "finding_pois", label: "Find POIs", slices: ["pois"] },
  { id: "creating_resupply_zones", label: "Generate resupply zones", slices: ["resupply"] },
  { id: "generating_route_visualization", label: "Generate timeline", slices: ["timeline"] },
  { id: "preparing_dashboard", label: "Prepare dashboard", slices: [] },
];

const INITIAL_READINESS: Record<ReadinessSlice, ReadinessStatus> = {
  distance: "waiting",
  elevation: "waiting",
  map: "waiting",
  climbs: "waiting",
  surface: "waiting",
  pois: "waiting",
  resupply: "waiting",
  timeline: "waiting",
};

export function createInitialAnalysisState(): AnalysisState {
  return {
    percent: 0,
    currentLabel: "Starting analysis…",
    stageId: null,
    subprogress: null,
    stats: {
      distance_km: null,
      elevation_gain_m: null,
      gpx_points: null,
      climb_count: null,
      surface_pct: null,
      asphalt_pct: null,
      gravel_pct: null,
      poi_count: null,
      zone_count: null,
    },
    readiness: { ...INITIAL_READINESS },
    checklist: CHECKLIST_DEFINITIONS.map((item) => ({
      id: item.id,
      label: item.label,
      status: "waiting" as ReadinessStatus,
      detail: null,
    })),
    logs: [],
    routePreview: null,
    livePreview: createEmptyLivePreview(),
    routeName: null,
    error: null,
    lastEventAt: Date.now(),
    pipelineSteps: {},
    performanceReport: [],
    performanceSummary: null,
  };
}

function deriveChecklist(readiness: Record<ReadinessSlice, ReadinessStatus>, stageId: string | null): ChecklistItem[] {
  return CHECKLIST_DEFINITIONS.map((definition, index) => {
    if (definition.id === "reading_gpx") {
      if (readiness.distance === "ready") {
        return { id: definition.id, label: definition.label, status: "ready", detail: null };
      }
      if (stageId === "reading_gpx") {
        return { id: definition.id, label: definition.label, status: "running", detail: null };
      }
      return { id: definition.id, label: definition.label, status: "waiting", detail: null };
    }

    if (definition.id === "preparing_dashboard") {
      if (readiness.timeline === "ready") {
        return { id: definition.id, label: definition.label, status: "running", detail: null };
      }
      return { id: definition.id, label: definition.label, status: "waiting", detail: null };
    }

    if (definition.slices.length > 0) {
      const sliceStatuses = definition.slices.map((slice) => readiness[slice]);
      if (sliceStatuses.every((status) => status === "ready")) {
        return { id: definition.id, label: definition.label, status: "ready", detail: null };
      }
      if (sliceStatuses.some((status) => status === "running" || status === "ready")) {
        return { id: definition.id, label: definition.label, status: "running", detail: null };
      }
      if (stageId === definition.id || definition.slices.some((slice) => stageId?.includes(slice))) {
        return { id: definition.id, label: definition.label, status: "running", detail: null };
      }
      const laterReady = CHECKLIST_DEFINITIONS.slice(index + 1).some((later) =>
        later.slices.some((slice) => readiness[slice] === "ready"),
      );
      if (laterReady) {
        return { id: definition.id, label: definition.label, status: "ready", detail: null };
      }
      return { id: definition.id, label: definition.label, status: "waiting", detail: null };
    }

    return { id: definition.id, label: definition.label, status: "waiting", detail: null };
  });
}

function appendLog(logs: LogEntry[], message: string): LogEntry[] {
  const last = logs[logs.length - 1];
  if (last?.message === message) {
    return logs;
  }
  return [...logs, { id: `${Date.now()}-${logs.length}`, message, at: Date.now() }].slice(-30);
}

function mergeLivePreview(
  current: AnalysisLivePreview,
  slice: string,
  data: Record<string, unknown>,
): AnalysisLivePreview {
  if (slice === "bootstrap") {
    const route = data.route as {
      track_points?: Array<{ lat: number; lon: number; km?: number }>;
      bounds?: AnalysisLivePreview["bounds"];
    };
    if (!route?.track_points) {
      return current;
    }
    return {
      ...current,
      track_points: route.track_points.map((point) => ({
        lat: point.lat,
        lon: point.lon,
        km: point.km ?? 0,
      })),
      bounds: route.bounds ?? current.bounds,
    };
  }

  if (slice === "climbs") {
    const climbs = (data.climbs as LiveClimb[] | undefined) ?? [];
    return {
      ...current,
      climbs: climbs.map((climb) => ({
        id: climb.id,
        start_km: climb.start_km,
        end_km: climb.end_km,
      })),
    };
  }

  if (slice === "surface" || slice === "timeline") {
    const route = data.route as {
      track_points?: LiveTrackPoint[];
      bounds?: AnalysisLivePreview["bounds"];
      surface_segments?: LiveSurfaceSegment[];
    };
    const next: AnalysisLivePreview = { ...current, surfaceReady: slice === "surface" || current.surfaceReady };
    if (route?.track_points?.length) {
      next.track_points = route.track_points.map((point) => ({
        lat: point.lat,
        lon: point.lon,
        km: point.km,
      }));
    }
    if (route?.bounds) {
      next.bounds = route.bounds;
    }
    if (route?.surface_segments?.length) {
      next.surface_segments = route.surface_segments.map((segment) => ({
        start_km: segment.start_km,
        end_km: segment.end_km,
        color: segment.color,
      }));
      next.surfaceReady = true;
    }
    return next;
  }

  if (slice === "pois") {
    const pois = (data.pois as Array<{ lat: number; lon: number }> | undefined) ?? [];
    return {
      ...current,
      pois: pois.map((poi) => ({ lat: poi.lat, lon: poi.lon })),
      poisReady: true,
    };
  }

  if (slice === "zones") {
    const zones =
      (data.resupply_zones as Array<{ zone_id: number; lat: number; lon: number }> | undefined) ?? [];
    return {
      ...current,
      zones: zones.map((zone) => ({
        zone_id: zone.zone_id,
        lat: zone.lat,
        lon: zone.lon,
      })),
      zonesReady: true,
    };
  }

  return current;
}

export function reduceAnalysisState(state: AnalysisState, event: unknown): AnalysisState {
  if (!event || typeof event !== "object" || !("type" in event)) {
    return state;
  }

  const record = event as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string") {
    return state;
  }

  const touched = { ...state, lastEventAt: Date.now() };

  if (type === "error") {
    const detail = typeof record.detail === "string" ? record.detail : "Analysis failed.";
    return {
      ...touched,
      error: detail,
      currentLabel: detail,
    };
  }

  if (type === "step") {
    const payload = record as {
      step_id: string;
      status: string;
      label?: string;
      detail?: string;
    };
    const pipelineSteps = { ...state.pipelineSteps };
    if (payload.status === "active" || payload.status === "complete" || payload.status === "error") {
      pipelineSteps[payload.step_id] = {
        status: payload.status,
        label: payload.label ?? payload.step_id,
        detail: payload.detail ?? null,
      };
    }
    const next = {
      ...touched,
      pipelineSteps,
      stageId: payload.status === "active" ? payload.step_id : state.stageId,
      currentLabel: payload.label ?? state.currentLabel,
    };
    return { ...next, checklist: deriveChecklist(state.readiness, next.stageId) };
  }

  if (type === "progress") {
    const payload = record as {
      percent: number;
      label: string;
      stage_id?: string | null;
    };
    const readiness = { ...state.readiness };
    const next = {
      ...touched,
      percent: payload.percent,
      currentLabel: payload.label,
      stageId: payload.stage_id ?? state.stageId,
      readiness,
    };
    return { ...next, checklist: deriveChecklist(readiness, payload.stage_id ?? null) };
  }

  if (type === "subprogress") {
    const payload = record as {
      stage_id: string;
      current: number;
      total: number;
      label: string;
    };
    return {
      ...touched,
      stageId: payload.stage_id,
      currentLabel: payload.label,
      subprogress: {
        label: payload.label,
        current: payload.current,
        total: payload.total,
      },
      checklist: deriveChecklist(state.readiness, payload.stage_id),
    };
  }

  if (type === "stats") {
    const payload = record as { payload: Partial<AnalysisStats> };
    const stats = { ...state.stats };
    for (const [key, value] of Object.entries(payload.payload)) {
      if (key in stats && value !== undefined) {
        (stats as Record<string, number | null>)[key] = value as number | null;
      }
    }
    return { ...touched, stats };
  }

  if (type === "readiness") {
    const payload = record as { slice: ReadinessSlice; status: ReadinessStatus };
    const readiness = { ...state.readiness, [payload.slice]: payload.status };
    return {
      ...touched,
      readiness,
      checklist: deriveChecklist(readiness, state.stageId),
    };
  }

  if (type === "log") {
    const payload = record as { message: string };
    return {
      ...touched,
      logs: appendLog(state.logs, payload.message),
    };
  }

  if (type === "performance") {
    const payload = record as {
      report: PerformanceStageRow[];
      summary?: PerformanceSummaryRow | null;
    };
    return {
      ...touched,
      performanceReport: payload.report ?? [],
      performanceSummary: payload.summary ?? state.performanceSummary,
    };
  }

  if (type === "partial") {
    const payload = record as { slice: string; data: Record<string, unknown> };
    const livePreview = mergeLivePreview(state.livePreview, payload.slice, payload.data);

    if (payload.slice === "bootstrap") {
      const route = payload.data.route as AnalysisState["routePreview"] & {
        track_points: Array<{ lat: number; lon: number }>;
      };
      const summary = payload.data.summary as { route_name?: string };
      return {
        ...touched,
        routeName: summary.route_name ?? state.routeName,
        livePreview,
        routePreview: route
          ? {
              track_points: route.track_points.map((point) => ({ lat: point.lat, lon: point.lon })),
              bounds: route.bounds,
            }
          : state.routePreview,
      };
    }

    return {
      ...touched,
      livePreview,
    };
  }

  return touched;
}

export function estimateRemainingSeconds(percent: number, elapsedSeconds: number): number | null {
  if (percent < 8 || percent >= 100) {
    return null;
  }
  const remaining = ((100 - percent) / percent) * elapsedSeconds;
  return Math.max(0, Math.round(remaining));
}
