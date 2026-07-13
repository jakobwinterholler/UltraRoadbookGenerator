/** Developer-only basemap catalog — no API keys required. */

export interface MapStyleTileLayer {
  url: string;
  opacity?: number;
  maxNativeZoom?: number;
}

/** Styles we may adopt later — compared via uploaded screenshots, not live tiles. */
export type TargetMapStyleId =
  | "current-carto"
  | "thunderforest-landscape"
  | "thunderforest-outdoors"
  | "maptiler-outdoor"
  | "stadia-stamen-terrain";

/** Free live tiles for immediate on-route exploration (directional proxies). */
export type FreeLiveMapStyleId =
  | "current-carto"
  | "opentopomap"
  | "cyclosm"
  | "openhikingmap";

export interface TargetMapStyleDefinition {
  id: TargetMapStyleId;
  label: string;
  provider: string;
  description: string;
  evaluateFor: string;
  captureHint: string;
  previewUrl?: (lat: number, lon: number, zoom: number) => string | null;
}

export interface FreeLiveMapStyleDefinition {
  id: FreeLiveMapStyleId;
  label: string;
  provider: string;
  description: string;
  proxyFor: string;
  attribution: string;
  layers: MapStyleTileLayer[];
}

export const TARGET_MAP_STYLES: TargetMapStyleDefinition[] = [
  {
    id: "current-carto",
    label: "Current (Carto Voyager)",
    provider: "Carto + Esri hillshade",
    description: "Today’s planning basemap — the reference to beat or replace.",
    evaluateFor: "Baseline — road atlas feel vs outdoor planning.",
    captureHint: "Use the live preview below at the same scene, or screenshot from this app.",
  },
  {
    id: "thunderforest-landscape",
    label: "Thunderforest Landscape",
    provider: "Thunderforest",
    description: "Illustrated terrain-first cartography — forests, ridges, valleys.",
    evaluateFor: "Strongest “illustrated outdoor map” candidate.",
    captureHint:
      "Open the Thunderforest preview, navigate to the coordinates below, match zoom, screenshot.",
    previewUrl: () => "https://www.thunderforest.com/maps/landscape/",
  },
  {
    id: "thunderforest-outdoors",
    label: "Thunderforest Outdoors",
    provider: "Thunderforest",
    description: "Outdoor activity map — landcover, elevation tint, paths and settlements.",
    evaluateFor: "Komoot-like balance of terrain, towns, and paths.",
    captureHint:
      "Open the Thunderforest preview, navigate to the coordinates below, match zoom, screenshot.",
    previewUrl: () => "https://www.thunderforest.com/maps/outdoors/",
  },
  {
    id: "maptiler-outdoor",
    label: "MapTiler Outdoor",
    provider: "MapTiler",
    description: "Hiking-oriented vector style — trails, landcover, hillshade.",
    evaluateFor: "Modern outdoor platform style; good overlay behaviour.",
    captureHint: "Preview link opens centred on this scene — adjust slightly if needed, then screenshot.",
    previewUrl: (lat, lon, zoom) =>
      `https://www.maptiler.com/maps/#style=outdoor-v4&mode=2d&position=${zoom}/${lat}/${lon}`,
  },
  {
    id: "stadia-stamen-terrain",
    label: "Stadia Stamen Terrain",
    provider: "Stadia Maps",
    description: "Hand-drawn terrain — natural vegetation colours and hillshade.",
    evaluateFor: "Illustrated / fantasy hiking map aesthetic.",
    captureHint:
      "Open the Stadia preview, navigate to the coordinates below, match zoom, screenshot.",
    previewUrl: () => "https://docs.stadiamaps.com/map-styles/stamen-terrain/",
  },
];

export const FREE_LIVE_MAP_STYLES: FreeLiveMapStyleDefinition[] = [
  {
    id: "current-carto",
    label: "Current (Carto Voyager)",
    provider: "Carto + Esri hillshade",
    description: "Production reference basemap.",
    proxyFor: "Current production map",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · Relief &copy; Esri',
    layers: [
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
        opacity: 0.2,
        maxNativeZoom: 13,
      },
      {
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
      },
    ],
  },
  {
    id: "opentopomap",
    label: "OpenTopoMap",
    provider: "OpenTopoMap",
    description: "Topographic style with contours and hypsometric tint.",
    proxyFor: "Terrain-heavy outdoor maps (elevation readability)",
    attribution:
      'Map: &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>) · Data: &copy; OSM',
    layers: [{ url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" }],
  },
  {
    id: "cyclosm",
    label: "CyclOSM",
    provider: "OpenStreetMap France",
    description: "Cycling/outdoor style with strong green landcover.",
    proxyFor: "Vegetation-forward outdoor maps",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · Render &copy; <a href="https://www.openstreetmap.fr/">OSM France</a> ( CyclOSM )',
    layers: [{ url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png" }],
  },
  {
    id: "openhikingmap",
    label: "OpenHikingMap",
    provider: "openmaps.fr",
    description: "Hiking-oriented style — paths, nature, contours.",
    proxyFor: "Hiking / Komoot-adjacent outdoor styles",
    attribution:
      '&copy; <a href="https://wiki.openstreetmap.org/wiki/OpenHikingMap">OpenHikingMap</a> · <a href="https://openmaps.fr/donate">Donate</a> · &copy; OSM',
    layers: [{ url: "https://tile.openmaps.fr/openhikingmap/{z}/{x}/{y}.png" }],
  },
];

export const MAP_STYLE_EVALUATION_CLASS = "map-style-evaluation";

export const FREE_LIVE_STYLE_STORAGE_KEY = "ultra-roadbook.free-live-map-style";

export function targetStyleById(id: TargetMapStyleId): TargetMapStyleDefinition {
  return TARGET_MAP_STYLES.find((style) => style.id === id) ?? TARGET_MAP_STYLES[0];
}

export function freeLiveStyleById(id: FreeLiveMapStyleId): FreeLiveMapStyleDefinition {
  return FREE_LIVE_MAP_STYLES.find((style) => style.id === id) ?? FREE_LIVE_MAP_STYLES[0];
}

export function readStoredFreeLiveStyleId(): FreeLiveMapStyleId {
  if (typeof window === "undefined") {
    return "current-carto";
  }
  const stored = window.localStorage.getItem(FREE_LIVE_STYLE_STORAGE_KEY);
  if (stored && FREE_LIVE_MAP_STYLES.some((style) => style.id === stored)) {
    return stored as FreeLiveMapStyleId;
  }
  return "current-carto";
}

export function writeStoredFreeLiveStyleId(id: FreeLiveMapStyleId): void {
  window.localStorage.setItem(FREE_LIVE_STYLE_STORAGE_KEY, id);
}

export function openTopoMapUrl(lat: number, lon: number, zoom: number): string {
  return `https://opentopomap.org/#map=${zoom}/${lat}/${lon}`;
}
