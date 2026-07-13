/** Shared visual language for planning maps. */

export const PLANNING_MAP_CLASS = "planning-map";

/**
 * Nature-first basemap — Carto Voyager without labels.
 * Renders soft green landcover, blue water, grey urban areas and quiet roads.
 */
export const PLANNING_BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";

/** Subtle hillshade for mountainous / rocky terrain context. */
export const PLANNING_HILLSHADE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

export const PLANNING_BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · Relief &copy; <a href="https://www.esri.com/">Esri</a>';

/** Match StopVerificationMap route styling. */
export const ROUTE_STYLE = {
  core: "#6D28D9",
  halo: "#C4B5FD",
  glow: "#FFFFFF",
  faded: "#A78BFA",
  muted: "#C4B5FD",
} as const;

/** Semantic highlights — unchanged from prior planning UI. */
export const MAP_HIGHLIGHT = {
  climb: "#E85D04",
  unsupported: "#DC2626",
  detour: "#2563EB",
  context: "#78716c",
} as const;

export type RouteGlowVariant = "primary" | "compact" | "mini" | "faded";

export const ROUTE_GLOW_WEIGHTS: Record<
  RouteGlowVariant,
  { glow: number; halo: number; core: number }
> = {
  primary: { glow: 20, halo: 14, core: 9 },
  compact: { glow: 14, halo: 10, core: 6 },
  mini: { glow: 10, halo: 7, core: 5 },
  faded: { glow: 8, halo: 5, core: 3 },
};

export const ROUTE_GLOW_OPACITY: Record<RouteGlowVariant, { glow: number; halo: number; core: number }> =
  {
    primary: { glow: 0.92, halo: 0.95, core: 1 },
    compact: { glow: 0.9, halo: 0.94, core: 1 },
    mini: { glow: 0.88, halo: 0.92, core: 1 },
    faded: { glow: 0.35, halo: 0.4, core: 0.55 },
  };
