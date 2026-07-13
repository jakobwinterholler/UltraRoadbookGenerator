import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import type { RouteVisualization } from "../../api";
import type { RouteHighlight } from "../../planning/routeHighlights";
import { findNearestTrackIndex, trackPositionsInKmRange } from "../routeUtils";
import PlanningTileLayer from "../maps/PlanningTileLayer";
import RouteGlowLayers from "../maps/RouteGlowLayers";
import { MAP_HIGHLIGHT, PLANNING_MAP_CLASS } from "../maps/planningMapTheme";
import { PLANNING_MAP_STATIC_PROPS } from "../maps/planningMapInteraction";
import { fitPlanningRoute } from "../maps/planningMapView";

interface DashboardRouteOverviewMapProps {
  route: RouteVisualization;
  highlights: RouteHighlight[];
  hoveredHighlightId: string | null;
  onHighlightHover: (highlightId: string | null) => void;
  onSelectHighlight: (highlight: RouteHighlight) => void;
}

function challengeDivIcon(emoji: string, active: boolean): L.DivIcon {
  return L.divIcon({
    html: `<div class="dashboard-challenge-marker${active ? " dashboard-challenge-marker--active" : ""}" aria-hidden="true">${emoji}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function FitFullRoute({ route }: { route: RouteVisualization }) {
  const map = useMap();

  useEffect(() => {
    fitPlanningRoute(map, route, "overview", {
      regionalFocus: false,
      maxZoom: 11,
    });
  }, [map, route]);

  return null;
}

export default function DashboardRouteOverviewMap({
  route,
  highlights,
  hoveredHighlightId,
  onHighlightHover,
  onSelectHighlight,
}: DashboardRouteOverviewMapProps) {
  const routePositions = useMemo(
    () => route.track_points.map((point) => [point.lat, point.lon] as [number, number]),
    [route.track_points],
  );

  const segmentHighlights = useMemo(
    () =>
      highlights.filter(
        (highlight) =>
          highlight.segmentStartKm !== undefined && highlight.segmentEndKm !== undefined,
      ),
    [highlights],
  );

  const segmentPositionsById = useMemo(() => {
    const positions = new Map<string, [number, number][]>();
    for (const highlight of segmentHighlights) {
      positions.set(
        highlight.id,
        trackPositionsInKmRange(
          route.track_points,
          highlight.segmentStartKm!,
          highlight.segmentEndKm!,
        ),
      );
    }
    return positions;
  }, [route.track_points, segmentHighlights]);

  const activeSegmentPositions = hoveredHighlightId
    ? segmentPositionsById.get(hoveredHighlightId) ?? null
    : null;

  const markers = useMemo(
    () =>
      highlights
        .filter((highlight) => highlight.focusKm !== undefined)
        .map((highlight) => {
          const index = findNearestTrackIndex(route.track_points, highlight.focusKm!);
          const point = route.track_points[index];
          return { highlight, lat: point.lat, lon: point.lon };
        }),
    [highlights, route.track_points],
  );

  if (routePositions.length < 2) {
    return null;
  }

  const center = routePositions[Math.floor(routePositions.length / 2)] ?? [46.5, 8.0];

  return (
    <div className="overflow-hidden rounded-xl border border-line/30 bg-canvas/20">
      <div className="h-48 md:h-56">
        <MapContainer
          center={center}
          zoom={10}
          className={`${PLANNING_MAP_CLASS} h-full w-full`}
          attributionControl={false}
          {...PLANNING_MAP_STATIC_PROPS}
        >
          <PlanningTileLayer showAttribution={false} />
          <FitFullRoute route={route} />
          <RouteGlowLayers positions={routePositions} variant="compact" />
          {activeSegmentPositions && activeSegmentPositions.length >= 2 && (
            <>
              <Polyline
                positions={activeSegmentPositions}
                interactive={false}
                pathOptions={{
                  color: MAP_HIGHLIGHT.climb,
                  weight: 12,
                  opacity: 0.28,
                  lineCap: "round",
                }}
              />
              <Polyline
                positions={activeSegmentPositions}
                interactive={false}
                pathOptions={{
                  color: MAP_HIGHLIGHT.climb,
                  weight: 6,
                  opacity: 1,
                  lineCap: "round",
                }}
                className="dashboard-route-active-segment"
              />
            </>
          )}
          {segmentHighlights.map((highlight) => {
            const positions = segmentPositionsById.get(highlight.id);
            if (!positions || positions.length < 2) {
              return null;
            }

            return (
              <Polyline
                key={`hit-${highlight.id}`}
                positions={positions}
                pathOptions={{ color: MAP_HIGHLIGHT.climb, weight: 14, opacity: 0 }}
                eventHandlers={{
                  mouseover: () => onHighlightHover(highlight.id),
                  mouseout: () => onHighlightHover(null),
                  click: () => onSelectHighlight(highlight),
                }}
              />
            );
          })}
          {markers.map(({ highlight, lat, lon }) => (
            <Marker
              key={highlight.id}
              position={[lat, lon]}
              icon={challengeDivIcon(highlight.emoji, hoveredHighlightId === highlight.id)}
              zIndexOffset={hoveredHighlightId === highlight.id ? 500 : 0}
              eventHandlers={{
                mouseover: () => onHighlightHover(highlight.id),
                mouseout: () => onHighlightHover(null),
                click: () => onSelectHighlight(highlight),
              }}
            />
          ))}
        </MapContainer>
      </div>
      <p className="border-t border-line/20 px-4 py-2 text-xs text-muted">
        Geographic context — hover a marker to see where each challenge sits.
      </p>
    </div>
  );
}
