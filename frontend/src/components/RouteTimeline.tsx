import type { ResupplyZone, RouteVisualization } from "../api";
import type { OverlayMode, TimeMode } from "../planning/types";
import { legendForView, routeSegmentsForOverlay, timelineLabel, zoneMarkerColor } from "../planning/viewModel";
import OverlayLegend from "./OverlayLegend";
import type { ZoneGap } from "./routeInsights";
import { formatKm } from "./routeInsights";

interface RouteTimelineProps {
  totalKm: number;
  route: RouteVisualization;
  zones: ResupplyZone[];
  overlay: OverlayMode;
  timeMode: TimeMode;
  selectedZoneId: number | null;
  longestGap: ZoneGap | null;
  maxGapThresholdKm: number;
  onSelectZone: (zoneId: number) => void;
}

export default function RouteTimeline({
  totalKm,
  route,
  zones,
  overlay,
  timeMode,
  selectedZoneId,
  longestGap,
  maxGapThresholdKm: _maxGapThresholdKm,
  onSelectZone,
}: RouteTimelineProps) {
  if (totalKm <= 0) {
    return null;
  }

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    km: totalKm * fraction,
    leftPct: fraction * 100,
  }));

  const gapStartPct = longestGap ? (longestGap.startKm / totalKm) * 100 : 0;
  const gapWidthPct = longestGap ? (longestGap.gapKm / totalKm) * 100 : 0;
  const routeSegments = routeSegmentsForOverlay({ route, overlay });
  const legend = legendForView(overlay, timeMode);

  return (
    <div className="rounded-xl border border-line/80 bg-canvas/60 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {timelineLabel(overlay, timeMode)}
        </p>
        <p className="text-xs text-muted">
          {zones.length} stops · {formatKm(totalKm, 0)}
          {longestGap ? ` · longest gap ${formatKm(longestGap.gapKm, 0)}` : ""}
        </p>
      </div>

      <div className="relative h-4 overflow-hidden rounded-full bg-line/80">
        {routeSegments.map((segment, index) => {
          const leftPct = (segment.start_km / totalKm) * 100;
          const widthPct = ((segment.end_km - segment.start_km) / totalKm) * 100;
          return (
            <div
              key={`segment-${index}`}
              className="absolute inset-y-0"
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 0.2)}%`,
                backgroundColor: segment.color,
                opacity: overlay === "normal" ? 0.35 : 0.85,
              }}
            />
          );
        })}

        {longestGap && gapWidthPct > 0 && (
          <div
            className="absolute inset-y-0 rounded-full bg-amber-400/25"
            style={{ left: `${gapStartPct}%`, width: `${gapWidthPct}%` }}
            title={`Longest gap: ${formatKm(longestGap.gapKm, 0)}`}
          />
        )}
      </div>

      <div className="relative mt-2 h-5">
        {zones.map((zone) => {
          const leftPct = Math.min(Math.max((zone.distance_along_km / totalKm) * 100, 0), 100);
          const selected = zone.zone_id === selectedZoneId;
          const fill = zoneMarkerColor(zone, overlay, timeMode, routeSegments);
          return (
            <button
              key={zone.zone_id}
              type="button"
              title={`${zone.name} · ${formatKm(zone.distance_along_km, 1)}`}
              onClick={() => onSelectZone(zone.zone_id)}
              className={`absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition ${
                selected ? "scale-125 border-ink" : "border-white hover:scale-110"
              }`}
              style={{ left: `${leftPct}%`, backgroundColor: fill }}
            />
          );
        })}
      </div>

      <div className="relative mt-2 h-4">
        {axisTicks.map((tick) => (
          <span
            key={tick.km}
            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted"
            style={{ left: `${tick.leftPct}%` }}
          >
            {Math.round(tick.km)}
          </span>
        ))}
      </div>

      {legend.length > 0 && <OverlayLegend items={legend} className="mt-3" />}
    </div>
  );
}
