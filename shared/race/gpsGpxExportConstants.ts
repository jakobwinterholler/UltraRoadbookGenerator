/**
 * Coros GPX export v3.0 constants — keep in parity with src/race_gpx_export.py.
 *
 * Coros reads GPX `<sym>` (symbol) and `<type>` (classification) on `<wpt>` elements.
 * There is no universal GPX icon standard; Coros maps common sym strings to native icons.
 */

export const GPS_GPX_EXPORT_VERSION = "3.0";

export const ROUTE_INTEGRITY_FAILED_MESSAGE =
  "Route integrity verification failed. Export cancelled.";

/** Maximum off-route distance (m) for exportable waypoints. */
export const MAX_WAYPOINT_OFF_ROUTE_M = 500;

export const COROS_WPT_ICONS = [
  "Water",
  "Supplies",
  "Hazard",
  "Bathroom",
  "Hut",
  "Campsite",
  "Trailfork",
  "Pin",
] as const;

export type CorosWptIcon = (typeof COROS_WPT_ICONS)[number];

export const EXCLUDED_EXPORT_CATEGORY_KEYWORDS = [
  "climb",
  "summit",
  "unsupported",
  "analysis",
  "gap marker",
  "helper",
  "geometry",
] as const;

export function isInvalidExportName(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }
  const normalized = value.trim();
  const lowered = normalized.toLowerCase();
  if (["unnamed", "stop", "resupply", "resupply stop"].includes(lowered)) {
    return true;
  }
  if (/^checkpoint\s*\d+\.?$/.test(lowered)) {
    return true;
  }
  if (/^(fuel\s*)?station\s*\d+\.?$/.test(lowered)) {
    return true;
  }
  if (/^stop\s*\d+\.?$/.test(lowered)) {
    return true;
  }
  if (lowered.startsWith("carretera")) {
    return true;
  }
  return false;
}

export function resolveCorosWptIcon(input: {
  category: string;
  hasFuel?: boolean;
  hasWater?: boolean;
  hasFood?: boolean;
}): CorosWptIcon {
  const category = input.category.toLowerCase();
  if (
    input.hasWater ||
    category.includes("water") ||
    category.includes("drinking") ||
    category.includes("fountain")
  ) {
    return "Water";
  }
  if (
    input.hasFuel ||
    category.includes("fuel") ||
    category.includes("gas station") ||
    category.includes("gas_station")
  ) {
    return "Supplies";
  }
  if (
    input.hasFood ||
    category.includes("supermarket") ||
    category.includes("convenience") ||
    category.includes("mini supermarket") ||
    category.includes("small supermarket") ||
    category.includes("cafe") ||
    category.includes("café") ||
    category.includes("coffee") ||
    category.includes("restaurant") ||
    category.includes("fast food") ||
    category.includes("bakery") ||
    category.includes("shop")
  ) {
    return "Supplies";
  }
  if (category.includes("hazard") || category.includes("danger")) {
    return "Hazard";
  }
  if (category.includes("toilet") || category.includes("restroom") || category.includes("bathroom")) {
    return "Bathroom";
  }
  if (category.includes("shelter") || category.includes("hut") || category.includes("refuge")) {
    return "Hut";
  }
  if (category.includes("camp")) {
    return "Campsite";
  }
  if (
    category.includes("crossroad") ||
    category.includes("cross road") ||
    category.includes("junction") ||
    category.includes("trail fork")
  ) {
    return "Trailfork";
  }
  if (category.includes("bike") && category.includes("shop")) {
    return "Supplies";
  }
  return "Pin";
}

/** Emoji prefix for Coros `<name>` — icons use `<sym>` separately. */
export function corosWaypointEmoji(input: {
  category: string;
  hasFuel?: boolean;
  hasWater?: boolean;
  hasFood?: boolean;
}): string {
  const sym = resolveCorosWptIcon(input);
  const map: Record<CorosWptIcon, string> = {
    Water: "💧",
    Supplies: input.hasFuel ? "⛽" : input.hasFood ? "🛒" : "📦",
    Hazard: "⚠️",
    Bathroom: "🚻",
    Hut: "🏠",
    Campsite: "⛺",
    Trailfork: "🔀",
    Pin: "📍",
  };
  return map[sym] ?? "📍";
}

export function formatCorosWaypointName(input: {
  name?: string | null;
  brand?: string | null;
  category: string;
  hasFuel?: boolean;
  hasWater?: boolean;
  hasFood?: boolean;
  zoneName?: string | null;
  km?: number;
  resupplyReason?: string | null;
  isPrimary?: boolean;
}): string {
  const prefix = input.isPrimary === false ? "ALT " : "";
  const emoji = corosWaypointEmoji(input);
  const label = smartPoiLabel(input);
  if (label === "Fuel" && input.resupplyReason?.toLowerCase().includes("last")) {
    return `${prefix}${emoji} Last fuel`.trim().slice(0, 32);
  }
  if (label === "Water" && input.km != null && Number.isFinite(input.km)) {
    return `${prefix}${emoji} Water km ${Math.round(input.km)}`.trim().slice(0, 32);
  }
  return `${prefix}${emoji} ${label}`.trim().slice(0, 32);
}

export function smartPoiLabel(input: {
  name?: string | null;
  brand?: string | null;
  category: string;
  hasFuel?: boolean;
  hasWater?: boolean;
  hasFood?: boolean;
  zoneName?: string | null;
}): string {
  const brand = input.brand?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  if (brand && !isInvalidExportName(brand)) {
    return brand.slice(0, 14);
  }
  if (name && !isInvalidExportName(name)) {
    return name.slice(0, 14);
  }
  if (input.hasFuel) {
    return "Fuel";
  }
  if (input.hasWater) {
    return "Water";
  }
  if (input.hasFood) {
    return "Shop";
  }
  const category = input.category.toLowerCase();
  if (category.includes("supermarket")) {
    return "Supermarket";
  }
  if (category.includes("convenience")) {
    return "Shop";
  }
  if (category.includes("cafe") || category.includes("café")) {
    return "Café";
  }
  if (category.includes("restaurant")) {
    return "Restaurant";
  }
  if (category.includes("water") || category.includes("fountain")) {
    return "Water";
  }
  const zoneName = input.zoneName?.trim();
  if (zoneName && !isInvalidExportName(zoneName)) {
    return zoneName.slice(0, 14);
  }
  return "Stop";
}

export function isExcludedExportCategory(category: string): boolean {
  const lowered = category.toLowerCase();
  return EXCLUDED_EXPORT_CATEGORY_KEYWORDS.some((keyword) => lowered.includes(keyword));
}
