import { useEffect } from "react";
import { MapContainer, useMap } from "react-leaflet";
import type { AnalysisState } from "../analysis/analysisState";
import PlanningTileLayer from "./maps/PlanningTileLayer";
import RouteGlowLayers from "./maps/RouteGlowLayers";
import { PLANNING_MAP_CLASS } from "./maps/planningMapTheme";
import { fitPlanningBounds, PLANNING_FIT_PADDING } from "./maps/planningMapView";

interface AnalysisMiniMapProps {
  preview: AnalysisState["routePreview"];
}

function FitBounds({ preview }: { preview: NonNullable<AnalysisState["routePreview"]> }) {
  const map = useMap();

  useEffect(() => {
    const { south, west, north, east } = preview.bounds;
    fitPlanningBounds(
      map,
      [
        [south, west],
        [north, east],
      ],
      "mini",
      { padding: PLANNING_FIT_PADDING, animate: true, maxZoom: 13 },
    );
  }, [map, preview]);

  return null;
}

export default function AnalysisMiniMap({ preview }: AnalysisMiniMapProps) {
  if (!preview || preview.track_points.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-panel bg-surface-muted text-sm text-muted">
        Map appears after GPX is parsed
      </div>
    );
  }

  const positions = preview.track_points.map((point) => [point.lat, point.lon] as [number, number]);
  const center = positions[Math.floor(positions.length / 2)] ?? [46.5, 8.0];

  return (
    <div className="h-full min-h-[220px] overflow-hidden rounded-panel">
      <MapContainer
        center={center}
        zoom={11}
        className={`${PLANNING_MAP_CLASS} h-full w-full`}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <PlanningTileLayer showAttribution={false} />
        <RouteGlowLayers positions={positions} variant="mini" />
        <FitBounds preview={preview} />
      </MapContainer>
    </div>
  );
}
