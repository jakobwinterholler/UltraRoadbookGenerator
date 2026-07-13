import { Fragment, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, useMap } from "react-leaflet";
import type { AnalysisLivePreview } from "../analysis/liveMapUtils";
import { trackPositionsInKmRange } from "../analysis/liveMapUtils";
import PlanningTileLayer from "./maps/PlanningTileLayer";
import RouteGlowLayers from "./maps/RouteGlowLayers";
import { MAP_HIGHLIGHT, PLANNING_MAP_CLASS } from "./maps/planningMapTheme";
import { fitPlanningBounds, PLANNING_FIT_PADDING } from "./maps/planningMapView";

interface AnalysisLiveMapProps {
  preview: AnalysisLivePreview;
}

function FitBounds({ preview }: { preview: AnalysisLivePreview }) {
  const map = useMap();

  useEffect(() => {
    if (preview.track_points.length === 0) {
      return;
    }
    const { south, west, north, east } = preview.bounds;
    if (north <= south || east <= west) {
      return;
    }

    fitPlanningBounds(
      map,
      [
        [south, west],
        [north, east],
      ],
      "overview",
      { padding: PLANNING_FIT_PADDING, animate: true, maxZoom: 12 },
    );
  }, [map, preview.bounds, preview.track_points.length]);

  return null;
}

export default function AnalysisLiveMap({ preview }: AnalysisLiveMapProps) {
  const [visibleClimbCount, setVisibleClimbCount] = useState(0);

  useEffect(() => {
    if (preview.climbs.length === 0) {
      setVisibleClimbCount(0);
      return;
    }

    setVisibleClimbCount(1);
    if (preview.climbs.length === 1) {
      return;
    }

    let index = 1;
    const interval = window.setInterval(() => {
      index += 1;
      setVisibleClimbCount(index);
      if (index >= preview.climbs.length) {
        window.clearInterval(interval);
      }
    }, 280);

    return () => window.clearInterval(interval);
  }, [preview.climbs]);

  const routePositions = useMemo(
    () => preview.track_points.map((point) => [point.lat, point.lon] as [number, number]),
    [preview.track_points],
  );

  const surfacePolylines = useMemo(() => {
    if (!preview.surfaceReady || preview.surface_segments.length === 0) {
      return [];
    }
    return preview.surface_segments
      .map((segment) => ({
        key: `${segment.start_km}-${segment.end_km}-${segment.color}`,
        positions: trackPositionsInKmRange(
          preview.track_points,
          segment.start_km,
          segment.end_km,
        ),
        color: segment.color,
      }))
      .filter((segment) => segment.positions.length >= 2);
  }, [preview.surfaceReady, preview.surface_segments, preview.track_points]);

  const visibleClimbs = preview.climbs.slice(0, visibleClimbCount);

  if (preview.track_points.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-panel border border-line/40 bg-surface-muted text-sm text-muted">
        Route appears as soon as the GPX is parsed…
      </div>
    );
  }

  const center = routePositions[Math.floor(routePositions.length / 2)] ?? [46.5, 8.0];

  return (
    <div className="relative overflow-hidden rounded-panel border border-line/40 bg-white">
      <div className="h-[min(52vh,420px)] min-h-[320px]">
        <MapContainer
          center={center}
          zoom={10}
          className={`${PLANNING_MAP_CLASS} h-full w-full`}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          zoomControl={false}
          attributionControl={false}
        >
          <PlanningTileLayer showAttribution={false} />
          <FitBounds preview={preview} />
          <RouteGlowLayers
            positions={routePositions}
            variant={preview.surfaceReady ? "faded" : "compact"}
          />
          {surfacePolylines.map((segment) => (
            <Polyline
              key={segment.key}
              positions={segment.positions}
              pathOptions={{
                color: segment.color,
                weight: 4,
                opacity: 0.88,
                lineCap: "round",
              }}
            />
          ))}
          {visibleClimbs.map((climb) => {
            const positions = trackPositionsInKmRange(
              preview.track_points,
              climb.start_km,
              climb.end_km,
            );
            if (positions.length < 2) {
              return null;
            }
            const midpoint = positions[Math.floor(positions.length / 2)];
            return (
              <Fragment key={climb.id}>
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color: MAP_HIGHLIGHT.climb,
                    weight: 6,
                    opacity: 0.95,
                    lineCap: "round",
                  }}
                />
                <CircleMarker
                  center={midpoint}
                  radius={5}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: MAP_HIGHLIGHT.climb,
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              </Fragment>
            );
          })}
          {preview.poisReady &&
            preview.pois.map((poi, index) => (
              <CircleMarker
                key={`poi-${index}-${poi.lat}-${poi.lon}`}
                center={[poi.lat, poi.lon]}
                radius={3}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: "#0ea5e9",
                  fillOpacity: 0.85,
                  weight: 1,
                }}
              />
            ))}
          {preview.zonesReady &&
            preview.zones.map((zone) => (
              <CircleMarker
                key={`zone-${zone.zone_id}`}
                center={[zone.lat, zone.lon]}
                radius={6}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: "#059669",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            ))}
        </MapContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line/30 px-4 py-2.5 text-xs text-muted">
        <span>{preview.track_points.length.toLocaleString()} track points</span>
        {preview.climbs.length > 0 && <span>{preview.climbs.length} climbs</span>}
        {preview.surfaceReady && <span>Surface mapped</span>}
        {preview.poisReady && <span>{preview.pois.length.toLocaleString()} POIs</span>}
        {preview.zonesReady && <span>{preview.zones.length} resupply zones</span>}
      </div>
    </div>
  );
}
