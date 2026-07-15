import type { PoiDebugRow } from "../../api";
import type { NearbyPoiDebugEntry } from "../../planning/poiDebug";
import { poiDebugStatusLabel, poiDebugTitle } from "../../planning/poiDebug";

interface PoiDebugPanelProps {
  entries: NearbyPoiDebugEntry[];
  selectedEntry: PoiDebugRow | null;
  clickLatLng: { lat: number; lon: number } | null;
  onSelectEntry: (entry: PoiDebugRow) => void;
  onClose: () => void;
}

function formatOptional(value: string | number | boolean | null | undefined, suffix = ""): string {
  if (value == null || value === "") {
    return "—";
  }
  return `${value}${suffix}`;
}

function formatScore(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(1);
}

function PoiDebugDetails({ entry }: { entry: PoiDebugRow }) {
  const imported = entry.status === "imported";

  return (
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

      <dt className="text-muted">Primary score</dt>
      <dd>{formatScore(entry.primary_score ?? entry.score)}</dd>

      <dt className="text-muted">Fuel score</dt>
      <dd>{formatScore(entry.fuel_score)}</dd>

      <dt className="text-muted">Food score</dt>
      <dd>{formatScore(entry.food_score)}</dd>

      <dt className="text-muted">Water score</dt>
      <dd>{formatScore(entry.water_score)}</dd>

      <dt className="text-muted">Cluster</dt>
      <dd>{formatOptional(entry.cluster_id)}</dd>

      <dt className="text-muted">Cluster winner</dt>
      <dd>{entry.cluster_winner == null ? "—" : entry.cluster_winner ? "Yes" : "No"}</dd>

      <dt className="text-muted">Bundle exported</dt>
      <dd>{entry.bundle_exported == null ? "—" : entry.bundle_exported ? "Yes" : "No"}</dd>

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
  );
}

export default function PoiDebugPanel({
  entries,
  selectedEntry,
  clickLatLng,
  onSelectEntry,
  onClose,
}: PoiDebugPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="absolute right-3 top-3 z-[500] w-[min(92vw,360px)] rounded-xl border border-line bg-card/95 p-4 shadow-card backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">POI debug</p>
          <button type="button" className="text-xs text-muted hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="text-sm text-muted">
          {clickLatLng
            ? "No POI candidates within 180 m of this point."
            : "Click the map to inspect imported or discarded POIs."}
        </p>
      </div>
    );
  }

  const activeEntry = selectedEntry ?? entries[0]?.entry ?? null;

  return (
    <div className="absolute right-3 top-3 z-[500] flex max-h-[min(78vh,720px)] w-[min(92vw,380px)] flex-col rounded-xl border border-line bg-card/95 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-2 border-b border-line/70 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">POI debug</p>
          <p className="text-base font-medium">
            {entries.length} nearby POI{entries.length === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" className="text-xs text-muted hover:text-foreground" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="overflow-y-auto px-4 py-3">
        <ul className="mb-3 space-y-1">
          {entries.map(({ entry, distanceM }) => {
            const selected =
              activeEntry?.osm_id === entry.osm_id && activeEntry?.osm_type === entry.osm_type;
            return (
              <li key={`${entry.osm_type}-${entry.osm_id}`}>
                <button
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selected
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line/70 bg-card hover:border-line"
                  }`}
                >
                  <span className="font-medium">{poiDebugTitle(entry)}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {poiDebugStatusLabel(entry)} · {Math.round(distanceM)} m ·{" "}
                    {entry.category ?? "Unknown"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {activeEntry ? <PoiDebugDetails entry={activeEntry} /> : null}
      </div>
    </div>
  );
}
