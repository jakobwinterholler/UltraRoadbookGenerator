import type { RouteVisualization, SurfaceInsight } from "../api";

export interface SurfaceCategoryStat {
  riderCategory: string;
  label: string;
  distanceKm: number;
  percentage: number;
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Road: "#2563eb",
  Gravel: "#854d0e",
  Trail: "#16a34a",
  Unknown: "#ef4444",
};

const CATEGORY_ORDER = ["Road", "Gravel", "Trail", "Unknown"];

export function buildSurfaceCategoryBreakdown(
  route: RouteVisualization,
  totalKm: number,
): SurfaceCategoryStat[] {
  const totals = new Map<string, number>();

  for (const segment of route.surface_segments) {
    const key = segment.rider_category ?? segment.surface;
    totals.set(key, (totals.get(key) ?? 0) + Math.max(0, segment.end_km - segment.start_km));
  }

  return CATEGORY_ORDER.map((category) => {
    const distanceKm = totals.get(category) ?? 0;
    return {
      riderCategory: category,
      label: category,
      distanceKm: Math.round(distanceKm * 10) / 10,
      percentage: totalKm > 0 ? Math.round((distanceKm / totalKm) * 1000) / 10 : 0,
      color: CATEGORY_COLORS[category] ?? "#9ca3af",
    };
  }).filter((row) => row.distanceKm > 0 || row.riderCategory === "Unknown");
}

export function surfaceSegmentMatchesSelection(
  segment: { rider_category?: string; surface: string; osm_surface: string | null },
  selected: string | null,
): boolean {
  if (!selected) {
    return true;
  }
  return (
    segment.rider_category === selected ||
    segment.surface === selected ||
    (segment.osm_surface ?? "unknown") === selected
  );
}

export function formatSurfaceKmRange(startKm: number, endKm: number): string {
  return `KM ${Math.round(startKm)} → ${Math.round(endKm)}`;
}

export function surfaceInsightDetail(insight: SurfaceInsight): string {
  const range = formatSurfaceKmRange(insight.start_km, insight.end_km);
  if (insight.subcategory) {
    return `${range} · ${insight.subcategory}`;
  }
  return range;
}

export function surfaceSourceLabel(source: string): string {
  switch (source) {
    case "osm_tag":
      return "OSM surface tag";
    case "highway_inferred":
      return "Inferred from road type";
    case "propagated":
      return "Propagated from neighbours";
    case "insufficient_evidence":
      return "Insufficient evidence";
    case "unmatched":
      return "No OSM match";
    default:
      return source;
  }
}
