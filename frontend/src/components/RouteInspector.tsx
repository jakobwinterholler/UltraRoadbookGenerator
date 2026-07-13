import type { TrackPoint, ResupplyZone } from "../api";
import { colorAtKm, routeSegmentsForOverlay } from "../planning/viewModel";
import type { OverlayMode, TimeMode } from "../planning/types";
import { formatKm, nearestZoneAtKm } from "./routeInsights";

interface RouteInspectorProps {
  point: TrackPoint | null;
  zones: ResupplyZone[];
  overlay: OverlayMode;
  timeMode: TimeMode;
  route?: import("../api").RouteVisualization;
  compact?: boolean;
}

export default function RouteInspector({
  point,
  zones,
  overlay,
  timeMode,
  route,
  compact = false,
}: RouteInspectorProps) {
  const nearestZone = point ? nearestZoneAtKm(zones, point.km) : null;
  const modeLabel =
    timeMode === "night"
      ? "Night planning"
      : overlay === "surface"
        ? "Surface overlay"
        : overlay === "resupply"
          ? "Resupply overlay"
          : "Route view";

  const segmentColor =
    point && route
      ? colorAtKm(point.km, routeSegmentsForOverlay({ route, overlay }))
      : null;

  if (compact) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-1 py-1 text-sm">
        <span className="text-xs text-muted">{modeLabel}</span>
        {point ? (
          <>
            <span>
              <span className="text-muted">Km </span>
              <span className="font-medium tabular-nums text-ink">{formatKm(point.km, 1)}</span>
            </span>
            <span>
              <span className="text-muted">Elev </span>
              <span className="font-medium tabular-nums text-ink">
                {point.ele_m !== null ? `${Math.round(point.ele_m)} m` : "—"}
              </span>
            </span>
            <span>
              <span className="text-muted">Gain </span>
              <span className="font-medium tabular-nums text-ink">+{Math.round(point.cumulative_gain_m)} m</span>
            </span>
            {segmentColor && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segmentColor }} />
                <span className="text-muted">
                  {overlay === "surface" ? "Surface" : overlay === "resupply" ? "Resupply" : "Route"}
                </span>
              </span>
            )}
            <span className="text-muted">
              Nearest stop: <span className="text-ink">{nearestZone?.name ?? "—"}</span>
            </span>
          </>
        ) : (
          <span className="text-muted">Hover the map or profile to inspect a position</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line/80 bg-card/95 px-4 py-3 text-sm shadow-sm backdrop-blur">
      <div className="min-w-[100px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Mode</p>
        <p className="mt-0.5 font-medium text-ink">{modeLabel}</p>
      </div>

      {point ? (
        <>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Position</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{formatKm(point.km, 1)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Elevation</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
              {point.ele_m !== null ? `${Math.round(point.ele_m)} m` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Gain so far</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
              +{Math.round(point.cumulative_gain_m)} m
            </p>
          </div>
          {segmentColor && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">At this point</p>
              <p className="mt-0.5 inline-flex items-center gap-2 font-medium text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segmentColor }} />
                {overlay === "surface" ? "Surface" : overlay === "resupply" ? "Resupply" : "Route"}
              </p>
            </div>
          )}
          <div className="min-w-[120px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Nearest stop</p>
            <p className="mt-0.5 font-medium text-ink">{nearestZone?.name ?? "No zone nearby"}</p>
          </div>
        </>
      ) : (
        <p className="text-muted">
          Hover the elevation profile or click the map to inspect a position along the route.
        </p>
      )}
    </div>
  );
}
