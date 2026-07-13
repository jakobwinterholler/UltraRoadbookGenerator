import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, useMap } from "react-leaflet";
import type { ClimbRow, PoiRow, RouteVisualization } from "../../api";
import { segmentPositionsForKmRange } from "../routeUtils";
import PlanningTileLayer from "../maps/PlanningTileLayer";
import RouteGlowLayers from "../maps/RouteGlowLayers";
import { MAP_HIGHLIGHT, PLANNING_MAP_CLASS } from "../maps/planningMapTheme";
import { PLANNING_MAP_INTERACTIVE_PROPS } from "../maps/planningMapInteraction";
import { fitPlanningPositions, PLANNING_FIT_PADDING } from "../maps/planningMapView";

interface ClimbLocalMapProps {
  route: RouteVisualization;
  climb: ClimbRow;
  pois: PoiRow[];
}

function FitClimbBounds({
  route,
  climb,
}: {
  route: RouteVisualization;
  climb: ClimbRow;
}) {
  const map = useMap();

  useEffect(() => {
    const positions = segmentPositionsForKmRange(route.track_points, climb.start_km, climb.end_km);
    if (positions.length >= 2) {
      fitPlanningPositions(map, positions, "local", {
        padding: PLANNING_FIT_PADDING,
        maxZoom: 15,
        animate: true,
      });
    }
  }, [map, route.track_points, climb.start_km, climb.end_km]);

  return null;
}

const POI_ICONS: Record<string, string> = {
  "Drinking water": "💧",
  "Gas station": "⛽",
  Supermarket: "🛒",
  "Small supermarket": "🛒",
  "Mini supermarket": "🛒",
  Bakery: "🥐",
};

export default function ClimbLocalMap({ route, climb, pois }: ClimbLocalMapProps) {
  const climbPositions = segmentPositionsForKmRange(route.track_points, climb.start_km, climb.end_km);
  const routePositions = route.track_points.map((point) => [point.lat, point.lon] as [number, number]);
  const relevantPois = pois.filter(
    (poi) =>
      poi.distance_along_km >= climb.start_km - 2 &&
      poi.distance_along_km <= climb.end_km + 5 &&
      (poi.category === "Drinking water" ||
        poi.category === "Gas station" ||
        poi.category.includes("supermarket") ||
        poi.category === "Bakery"),
  );

  if (climbPositions.length < 2) {
    return null;
  }

  const center = climbPositions[Math.floor(climbPositions.length / 2)];

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-muted transition hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          Local map
          <span className="text-xs text-accent">Show geographic detail</span>
        </span>
      </summary>
      <div className="mt-3 h-56 overflow-hidden rounded-xl border border-line/40 md:h-72">
        <MapContainer
          center={center}
          zoom={13}
          className={`${PLANNING_MAP_CLASS} h-full w-full`}
          attributionControl={false}
          {...PLANNING_MAP_INTERACTIVE_PROPS}
        >
          <PlanningTileLayer showAttribution={false} />
          <FitClimbBounds route={route} climb={climb} />
          <RouteGlowLayers positions={routePositions} variant="faded" />
          <Polyline
            positions={climbPositions}
            pathOptions={{ color: MAP_HIGHLIGHT.climb, weight: 6, opacity: 0.95, lineCap: "round" }}
          />
          {relevantPois.map((poi) => (
            <CircleMarker
              key={`${poi.osm_type}-${poi.osm_id}`}
              center={[poi.lat, poi.lon]}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                fillColor: poi.category === "Drinking water" ? "#0284c7" : MAP_HIGHLIGHT.climb,
                fillOpacity: 0.9,
                weight: 2,
              }}
            />
          ))}
        </MapContainer>
      </div>
      {relevantPois.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {relevantPois.map((poi) => POI_ICONS[poi.category] ?? "📍").join(" ")} resupply near this climb
        </p>
      )}
    </details>
  );
}
