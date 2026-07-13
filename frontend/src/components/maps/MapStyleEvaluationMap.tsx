import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, useMap } from "react-leaflet";
import type { ClimbRow, ResupplyZone, RouteVisualization } from "../../api";
import { legendForView } from "../../planning/viewModel";
import type { OverlayMode } from "../../planning/types";
import OverlayLegend from "../OverlayLegend";
import { buildColoredSegments, segmentPositionsForKmRange, zoneMarkerColor } from "../routeUtils";
import EvaluationBasemapLayers from "./EvaluationBasemapLayers";
import {
  freeLiveStyleById,
  MAP_STYLE_EVALUATION_CLASS,
  type FreeLiveMapStyleDefinition,
  type FreeLiveMapStyleId,
} from "./mapStyleCatalog";
import { fitEvaluationScene } from "./mapEvaluationView";
import type { EvaluationSceneRange } from "./mapEvaluationScenes";
import RouteGlowLayers from "./RouteGlowLayers";
import { MAP_HIGHLIGHT } from "./planningMapTheme";

interface FitEvaluationSceneProps {
  route: RouteVisualization;
  sceneRange: EvaluationSceneRange;
}

function FitEvaluationScene({ route, sceneRange }: FitEvaluationSceneProps) {
  const map = useMap();

  useEffect(() => {
    fitEvaluationScene(map, route, sceneRange.startKm, sceneRange.endKm);
  }, [map, route, sceneRange.startKm, sceneRange.endKm]);

  return null;
}

interface FreeBasemapPreviewMapProps {
  route: RouteVisualization;
  zones: ResupplyZone[];
  climbs: ClimbRow[];
  style: FreeLiveMapStyleDefinition;
  overlay: OverlayMode;
  sceneRange: EvaluationSceneRange;
  showZones: boolean;
  showClimbs: boolean;
}

function FreeBasemapPreviewMap({
  route,
  zones,
  climbs,
  style,
  overlay,
  sceneRange,
  showZones,
  showClimbs,
}: FreeBasemapPreviewMapProps) {
  const routePositions = useMemo(
    () => route.track_points.map((point) => [point.lat, point.lon] as [number, number]),
    [route.track_points],
  );
  const segments = useMemo(() => buildColoredSegments(route, overlay), [route, overlay]);
  const legend = legendForView(overlay, "day");

  const sceneZones = useMemo(
    () =>
      zones.filter(
        (zone) =>
          zone.distance_along_km >= sceneRange.startKm - 2 &&
          zone.distance_along_km <= sceneRange.endKm + 2,
      ),
    [zones, sceneRange.endKm, sceneRange.startKm],
  );

  const sceneClimbs = useMemo(
    () =>
      climbs.filter(
        (climb) => climb.end_km >= sceneRange.startKm && climb.start_km <= sceneRange.endKm,
      ),
    [climbs, sceneRange.endKm, sceneRange.startKm],
  );

  const center = route.track_points[Math.floor(route.track_points.length / 2)] ?? {
    lat: 46.5,
    lon: 8,
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-line/60 bg-card">
      <MapContainer
        key={`${style.id}-${sceneRange.startKm}-${sceneRange.endKm}-${overlay}`}
        center={[center.lat, center.lon]}
        zoom={11}
        className={`${MAP_STYLE_EVALUATION_CLASS} h-[min(52vh,480px)] w-full`}
        scrollWheelZoom
      >
        <EvaluationBasemapLayers
          id={style.id}
          attribution={style.attribution}
          layers={style.layers}
        />
        <FitEvaluationScene route={route} sceneRange={sceneRange} />

        {overlay === "normal" ? (
          <RouteGlowLayers positions={routePositions} variant="primary" />
        ) : (
          segments.map((segment, index) => (
            <Polyline
              key={`segment-${index}`}
              positions={segment.positions}
              pathOptions={{
                color: segment.color,
                weight: 6,
                opacity: 0.92,
                lineCap: "round",
              }}
            />
          ))
        )}

        {showClimbs &&
          sceneClimbs.map((climb) => {
            const positions = segmentPositionsForKmRange(
              route.track_points,
              climb.start_km,
              climb.end_km,
            );
            if (positions.length < 2) {
              return null;
            }
            return (
              <Polyline
                key={climb.id}
                positions={positions}
                pathOptions={{
                  color: MAP_HIGHLIGHT.climb,
                  weight: 5,
                  opacity: 0.95,
                  lineCap: "round",
                }}
              />
            );
          })}

        {showZones &&
          sceneZones.map((zone) => (
            <CircleMarker
              key={zone.zone_id}
              center={[zone.lat, zone.lon]}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                fillColor: zoneMarkerColor(zone, overlay, "day", route),
                fillOpacity: 0.7,
                opacity: 0.85,
                weight: 2,
              }}
            />
          ))}
      </MapContainer>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/40 px-3 py-2 text-xs text-muted">
        <span>
          {sceneRange.label} · {sceneRange.detail}
        </span>
        <span>{style.provider}</span>
      </div>

      <OverlayLegend items={legend} className="pointer-events-none absolute bottom-12 left-3" />
    </div>
  );
}

interface MapStyleEvaluationMapProps {
  route: RouteVisualization;
  zones: ResupplyZone[];
  climbs: ClimbRow[];
  styleId: FreeLiveMapStyleId;
  overlay: OverlayMode;
  sceneRange: EvaluationSceneRange;
  showZones: boolean;
  showClimbs: boolean;
}

export default function MapStyleEvaluationMap(props: MapStyleEvaluationMapProps) {
  const style = freeLiveStyleById(props.styleId);
  return <FreeBasemapPreviewMap {...props} style={style} />;
}
