import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import type { RouteVisualization } from "../../api";
import { findNearestTrackIndexByLatLng, trackPositionsInKmRange } from "../routeUtils";
import PlanningTileLayer from "../maps/PlanningTileLayer";
import RouteGlowLayers from "../maps/RouteGlowLayers";
import { MAP_HIGHLIGHT, PLANNING_MAP_CLASS } from "../maps/planningMapTheme";
import { PLANNING_MAP_STATIC_PROPS } from "../maps/planningMapInteraction";
import { fitPlanningPositions, fitPlanningRoute, PLANNING_FIT_PADDING } from "../maps/planningMapView";

export interface RouteContextMarker {
  lat: number;
  lon: number;
  label?: string;
  emoji?: string;
  active?: boolean;
  verified?: boolean;
}

interface RouteContextMiniMapProps {
  route: RouteVisualization;
  highlightRange?: { startKm: number; endKm: number } | null;
  markers?: RouteContextMarker[];
  fitToHighlight?: boolean;
}

function markerDivIcon(emoji: string, active: boolean, verified: boolean): L.DivIcon {
  const verifiedBadge = verified
    ? `<span class="route-context-marker__verified" aria-hidden="true">✓</span>`
    : "";
  return L.divIcon({
    html: `<div class="route-context-marker${active ? " route-context-marker--active" : ""}${verified ? " route-context-marker--verified" : ""}" aria-hidden="true">${emoji}${verifiedBadge}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitMapBounds({
  route,
  highlightRange,
  fitToHighlight,
}: {
  route: RouteVisualization;
  highlightRange?: { startKm: number; endKm: number } | null;
  fitToHighlight?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (fitToHighlight && highlightRange) {
      const positions = trackPositionsInKmRange(
        route.track_points,
        highlightRange.startKm,
        highlightRange.endKm,
      );
      if (positions.length >= 2) {
        fitPlanningPositions(map, positions, "local", {
          padding: PLANNING_FIT_PADDING,
          maxZoom: 14,
        });
        return;
      }
    }

    fitPlanningRoute(map, route, "mini", {
      padding: PLANNING_FIT_PADDING,
      regionalFocus: false,
    });
  }, [map, route, highlightRange, fitToHighlight]);

  return null;
}

export default function RouteContextMiniMap({
  route,
  highlightRange = null,
  markers = [],
  fitToHighlight = false,
}: RouteContextMiniMapProps) {
  const routePositions = useMemo(
    () => route.track_points.map((point) => [point.lat, point.lon] as [number, number]),
    [route.track_points],
  );

  const highlightPositions = useMemo(() => {
    if (!highlightRange) {
      return null;
    }
    return trackPositionsInKmRange(
      route.track_points,
      highlightRange.startKm,
      highlightRange.endKm,
    );
  }, [route.track_points, highlightRange]);

  const detourLines = useMemo(() => {
    return markers.flatMap((marker) => {
      const index = findNearestTrackIndexByLatLng(route.track_points, marker.lat, marker.lon);
      const trackPoint = route.track_points[index];
      if (!trackPoint) {
        return [];
      }
      return [
        [
          [trackPoint.lat, trackPoint.lon],
          [marker.lat, marker.lon],
        ] as [number, number][],
      ];
    });
  }, [markers, route.track_points]);

  if (routePositions.length < 2) {
    return null;
  }

  const center = routePositions[Math.floor(routePositions.length / 2)] ?? [46.5, 8.0];

  return (
    <div className="overflow-hidden rounded-xl border border-line/50 bg-white">
      <div className="h-44 sm:h-52">
        <MapContainer
          center={center}
          zoom={10}
          className={`${PLANNING_MAP_CLASS} h-full w-full`}
          attributionControl={false}
          {...PLANNING_MAP_STATIC_PROPS}
        >
          <PlanningTileLayer showAttribution={false} />
          <FitMapBounds
            route={route}
            highlightRange={highlightRange}
            fitToHighlight={fitToHighlight}
          />
          <RouteGlowLayers positions={routePositions} variant="compact" />
          {highlightPositions && highlightPositions.length >= 2 && (
            <>
              <Polyline
                positions={highlightPositions}
                interactive={false}
                pathOptions={{
                  color: MAP_HIGHLIGHT.unsupported,
                  weight: 10,
                  opacity: 0.25,
                  lineCap: "round",
                }}
              />
              <Polyline
                positions={highlightPositions}
                interactive={false}
                pathOptions={{
                  color: MAP_HIGHLIGHT.unsupported,
                  weight: 5,
                  opacity: 1,
                  lineCap: "round",
                }}
              />
            </>
          )}
          {detourLines.map((line, index) => (
            <Polyline
              key={`detour-${index}`}
              positions={line}
              pathOptions={{
                color: MAP_HIGHLIGHT.detour,
                weight: 2,
                opacity: 0.65,
                dashArray: "4 6",
              }}
            />
          ))}
          {markers.map((marker, index) => (
            <Marker
              key={`${marker.lat}-${marker.lon}-${index}`}
              position={[marker.lat, marker.lon]}
              icon={markerDivIcon(marker.emoji ?? "📍", marker.active ?? false, marker.verified ?? false)}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
