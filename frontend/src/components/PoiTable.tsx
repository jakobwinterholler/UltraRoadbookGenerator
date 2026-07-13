import { useMemo, useState } from "react";
import type { PoiRow } from "../api";
import { formatOffRouteDistance } from "./poiUi";
import OffRouteBadge from "./OffRouteBadge";

interface PoiTableProps {
  pois: PoiRow[];
  selectedPoiKey?: string | null;
  onSelectPoi?: (poi: PoiRow) => void;
}

function formatName(name: string | null): string {
  return name ?? "—";
}

function formatOptional(value: string | null): string {
  return value ?? "—";
}

function priorityLabel(priority: number): string {
  return `P${priority}`;
}

function priorityClass(priority: number): string {
  if (priority === 1) {
    return "bg-accent/10 text-accent";
  }
  return "bg-canvas text-muted";
}

function matchesSearch(poi: PoiRow, query: string): boolean {
  const haystack = [
    poi.name,
    poi.category,
    priorityLabel(poi.priority),
    formatOffRouteDistance(poi.distance_off_route_m),
    poi.brand,
    poi.opening_hours,
    poi.zone_id ? `zone ${poi.zone_id}` : "unzoned",
    String(poi.score),
    String(poi.osm_id),
    ...Object.entries(poi.tags).map(([key, value]) => `${key}=${value}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function PoiTable({ pois, selectedPoiKey = null, onSelectPoi }: PoiTableProps) {
  const [search, setSearch] = useState("");

  const filteredPois = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return pois;
    }
    return pois.filter((poi) => matchesSearch(poi, query));
  }, [pois, search]);

  const zonedCount = useMemo(
    () => pois.filter((poi) => poi.zone_id !== null).length,
    [pois],
  );

  if (pois.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card">
        <p className="text-muted">No POIs found within 500 m of this route.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Showing {filteredPois.length} of {pois.length} POIs · {zonedCount} assigned to zones
        </p>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, category, zone, brand..."
          className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-accent/40 sm:max-w-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-4 font-semibold">Zone</th>
                <th className="px-5 py-4 font-semibold">Off route</th>
                <th className="px-5 py-4 font-semibold">Name</th>
                <th className="px-5 py-4 font-semibold">Category</th>
                <th className="px-5 py-4 font-semibold">Route (km)</th>
                <th className="px-5 py-4 font-semibold">Score</th>
                <th className="px-5 py-4 font-semibold">Brand</th>
                <th className="px-5 py-4 font-semibold">Opening Hours</th>
                <th className="px-5 py-4 font-semibold">Tags</th>
              </tr>
            </thead>
            <tbody>
              {filteredPois.map((poi, index) => {
                const rowKey = `${poi.osm_type}-${poi.osm_id}`;
                const selected = selectedPoiKey === rowKey;
                return (
                <tr
                  key={rowKey}
                  onClick={() => onSelectPoi?.(poi)}
                  className={`border-b border-line/70 transition hover:bg-canvas/40 ${
                    index % 2 === 0 ? "bg-white" : "bg-canvas/20"
                  } ${onSelectPoi ? "cursor-pointer" : ""} ${
                    selected ? "ring-1 ring-inset ring-accent/30 bg-accent/[0.03]" : ""
                  }`}
                >
                  <td className="px-5 py-4 tabular-nums text-muted">
                    {poi.zone_id ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    <OffRouteBadge meters={poi.distance_off_route_m} tone={poi.detour_tone} />
                  </td>
                  <td className="px-5 py-4 font-medium text-ink">{formatName(poi.name)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass(poi.priority)}`}
                      >
                        {priorityLabel(poi.priority)}
                      </span>
                      <span className="text-ink">{poi.category}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 tabular-nums">{poi.distance_along_km.toFixed(2)}</td>
                  <td className="px-5 py-4 tabular-nums text-muted">{poi.score.toFixed(1)}</td>
                  <td className="px-5 py-4 text-muted">{formatOptional(poi.brand)}</td>
                  <td className="px-5 py-4 text-muted">{formatOptional(poi.opening_hours)}</td>
                  <td className="px-5 py-4 text-muted">
                    <span title={JSON.stringify(poi.tags, null, 2)}>
                      {Object.keys(poi.tags).length} tags
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
