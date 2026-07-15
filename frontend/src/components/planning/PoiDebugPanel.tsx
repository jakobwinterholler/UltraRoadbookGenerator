import type { PoiDebugRow } from "../../api";
import { poiDebugStatusLabel, poiDebugTitle } from "../../planning/poiDebug";

interface PoiDebugPanelProps {
  entry: PoiDebugRow | null;
  clickLatLng: { lat: number; lon: number } | null;
  onClose: () => void;
}

function formatOptional(value: string | number | null | undefined, suffix = ""): string {
  if (value == null || value === "") {
    return "—";
  }
  return `${value}${suffix}`;
}

export default function PoiDebugPanel({ entry, clickLatLng, onClose }: PoiDebugPanelProps) {
  if (!entry) {
    return (
      <div className="absolute right-3 top-3 z-[500] w-[min(92vw,320px)] rounded-xl border border-line bg-card/95 p-4 shadow-card backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">POI debug</p>
          <button type="button" className="text-xs text-muted hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="text-sm text-muted">
          {clickLatLng
            ? "No POI candidate within 180 m of this point."
            : "Click the map to inspect imported or discarded POIs."}
        </p>
      </div>
    );
  }

  const imported = entry.status === "imported";

  return (
    <div className="absolute right-3 top-3 z-[500] w-[min(92vw,340px)] rounded-xl border border-line bg-card/95 p-4 shadow-card backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">POI debug</p>
          <p className="text-base font-medium">{poiDebugTitle(entry)}</p>
        </div>
        <button type="button" className="text-xs text-muted hover:text-foreground" onClick={onClose}>
          Close
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">Status</dt>
        <dd className={imported ? "text-emerald-700" : "text-amber-700"}>{poiDebugStatusLabel(entry)}</dd>

        {!imported && (
          <>
            <dt className="text-muted">Stage</dt>
            <dd>{formatOptional(entry.discard_stage)}</dd>
            <dt className="text-muted">Reason</dt>
            <dd>{formatOptional(entry.discard_reason)}</dd>
          </>
        )}

        <dt className="text-muted">Category</dt>
        <dd>{formatOptional(entry.category)}</dd>

        <dt className="text-muted">Distance from route</dt>
        <dd>{formatOptional(entry.distance_off_route_m, " m")}</dd>

        <dt className="text-muted">Along route</dt>
        <dd>{formatOptional(entry.distance_along_km, " km")}</dd>

        <dt className="text-muted">Score</dt>
        <dd>{entry.score == null ? "—" : entry.score.toFixed(1)}</dd>

        <dt className="text-muted">Cluster</dt>
        <dd>{formatOptional(entry.cluster_id)}</dd>

        {imported && (
          <>
            <dt className="text-muted">Zone</dt>
            <dd>{formatOptional(entry.zone_id)}</dd>
            <dt className="text-muted">Zone role</dt>
            <dd>{formatOptional(entry.zone_role)}</dd>
          </>
        )}

        <dt className="text-muted">OSM</dt>
        <dd>
          {entry.osm_type}-{entry.osm_id}
        </dd>
      </dl>
    </div>
  );
}
