import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Tooltip, useMap } from "react-leaflet";
import type { ClimbRow, RouteVisualization } from "../../api";
import PlanningTileLayer from "../maps/PlanningTileLayer";
import RouteGlowLayers from "../maps/RouteGlowLayers";
import { MAP_HIGHLIGHT, PLANNING_MAP_CLASS } from "../maps/planningMapTheme";
import { PLANNING_MAP_STATIC_PROPS } from "../maps/planningMapInteraction";
import { fitPlanningRoute, PLANNING_FIT_PADDING } from "../maps/planningMapView";

interface RouteContextMapProps {
  route: RouteVisualization;
  climb: ClimbRow;
  totalKm: number;
}

function FitFullRoute({ route }: { route: RouteVisualization }) {
  const map = useMap();

  useEffect(() => {
    fitPlanningRoute(map, route, "mini", {
      padding: PLANNING_FIT_PADDING,
      regionalFocus: false,
      maxZoom: 11,
      animate: true,
    });
  }, [map, route]);

  return null;
}

export default function RouteContextMap({ route, climb, totalKm }: RouteContextMapProps) {
  const routePositions = route.track_points.map((point) => [point.lat, point.lon] as [number, number]);
  const climbPositions = route.track_points
    .filter((point) => point.km >= climb.start_km && point.km <= climb.end_km)
    .map((point) => [point.lat, point.lon] as [number, number]);

  if (routePositions.length < 2 || climbPositions.length < 2) {
    return null;
  }

  const startPoint = route.track_points[0];
  const finishPoint = route.track_points[route.track_points.length - 1];
  const climbMidpoint = climbPositions[Math.floor(climbPositions.length / 2)];

  return (
    <div>
      <p className="mb-3 text-xs tabular-nums text-muted">
        km {Math.round(climb.start_km)}–{Math.round(climb.end_km)} of {Math.round(totalKm)}
      </p>
      <div className="h-44 overflow-hidden rounded-xl border border-line/40 md:h-52">
        <MapContainer
          center={climbMidpoint}
          zoom={10}
          className={`${PLANNING_MAP_CLASS} h-full w-full`}
          attributionControl={false}
          {...PLANNING_MAP_STATIC_PROPS}
        >
          <PlanningTileLayer showAttribution={false} />
          <FitFullRoute route={route} />
          <RouteGlowLayers positions={routePositions} variant="faded" />
          <Polyline
            positions={climbPositions}
            pathOptions={{ color: MAP_HIGHLIGHT.climb, weight: 7, opacity: 1, lineCap: "round" }}
          />
          <CircleMarker
            center={[startPoint.lat, startPoint.lon]}
            radius={5}
            pathOptions={{ color: "#ffffff", fillColor: "#78716c", fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]} className="route-context-label">
              Start
            </Tooltip>
          </CircleMarker>
          <CircleMarker
            center={[finishPoint.lat, finishPoint.lon]}
            radius={5}
            pathOptions={{ color: "#ffffff", fillColor: "#78716c", fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]} className="route-context-label">
              Finish
            </Tooltip>
          </CircleMarker>
          <CircleMarker
            center={climbMidpoint}
            radius={6}
            pathOptions={{ color: "#ffffff", fillColor: MAP_HIGHLIGHT.climb, fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]} className="route-context-label">
              This climb
            </Tooltip>
          </CircleMarker>
        </MapContainer>
      </div>
    </div>
  );
}
