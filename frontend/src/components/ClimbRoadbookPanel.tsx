import { useMemo } from "react";
import type { ClimbRow, PoiRow, ResupplyZone, RouteVisualization, TrackPoint } from "../api";
import { buildClimbRoadbook, climbProfilePoints } from "../planning/climbRoadbook";
import ClimbMiniMap from "./ClimbMiniMap";
import ClimbMiniProfile from "./ClimbMiniProfile";

interface ClimbRoadbookPanelProps {
  climb: ClimbRow;
  route: RouteVisualization;
  pois: PoiRow[];
  zones: ResupplyZone[];
}

function GapStat({ label, km, priority }: { label: string; km: number | null; priority?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${priority ? "bg-sky-50 ring-1 ring-sky-200" : "bg-canvas"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
        {km === null ? "None within 120 km" : `${Math.round(km)} km`}
      </p>
    </div>
  );
}

export default function ClimbRoadbookPanel({
  climb,
  route,
  pois,
  zones,
}: ClimbRoadbookPanelProps) {
  const roadbook = useMemo(
    () => buildClimbRoadbook(climb, pois, zones, route.track_points as TrackPoint[]),
    [climb, pois, zones, route.track_points],
  );
  const profilePoints = useMemo(
    () => climbProfilePoints(climb, route.track_points as TrackPoint[]),
    [climb, route.track_points],
  );

  return (
    <div className="mt-4 space-y-4 border-t border-line/70 pt-4">
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-200">
        {roadbook.refillAdvice}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClimbMiniProfile climb={climb} points={profilePoints} steepSections={roadbook.steepSections} />
        <ClimbMiniMap route={route} climb={climb} pois={pois} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <GapStat label="Summit → next reliable water" km={roadbook.nextReliableWaterKm} priority />
        <GapStat label="Summit → next reliable food" km={roadbook.nextReliableFoodKm} />
      </div>

      {(roadbook.onClimbWater.length > 0 ||
        roadbook.onClimbFuel.length > 0 ||
        roadbook.onClimbFood.length > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">On the climb</p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {roadbook.onClimbWater.map((poi) => (
              <li key={`w-${poi.osm_id}`}>💧 {poi.name ?? "Water"} · {poi.distance_along_km.toFixed(1)} km</li>
            ))}
            {roadbook.onClimbFood.map((poi) => (
              <li key={`f-${poi.osm_id}`}>🛒 {poi.name ?? poi.category} · {poi.distance_along_km.toFixed(1)} km</li>
            ))}
            {roadbook.onClimbFuel.map((poi) => (
              <li key={`g-${poi.osm_id}`}>⛽ {poi.name ?? "Fuel"} · {poi.distance_along_km.toFixed(1)} km</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
