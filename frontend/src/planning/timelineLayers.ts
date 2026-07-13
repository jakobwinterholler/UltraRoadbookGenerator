import type { OverlayMode } from "./types";

export interface TimelineLayers {
  climbs: boolean;
  rejectedClimbs: boolean;
  surface: boolean;
  food: boolean;
  water: boolean;
  resupply: boolean;
  dangerous: boolean;
}

export const DEFAULT_TIMELINE_LAYERS: TimelineLayers = {
  climbs: false,
  rejectedClimbs: false,
  surface: false,
  food: false,
  water: false,
  resupply: false,
  dangerous: false,
};

export function layersForOverlay(overlay: OverlayMode): TimelineLayers {
  switch (overlay) {
    case "surface":
      return {
        climbs: false,
        rejectedClimbs: false,
        surface: true,
        food: false,
        water: false,
        resupply: false,
        dangerous: false,
      };
    case "resupply":
      return {
        climbs: false,
        rejectedClimbs: false,
        surface: false,
        food: true,
        water: true,
        resupply: true,
        dangerous: true,
      };
    case "normal":
    default:
      return {
        climbs: true,
        rejectedClimbs: false,
        surface: false,
        food: false,
        water: false,
        resupply: false,
        dangerous: false,
      };
  }
}

export const TIMELINE_LAYER_OPTIONS: { key: keyof TimelineLayers; label: string }[] = [
  { key: "climbs", label: "Climbs" },
  { key: "surface", label: "Surface" },
  { key: "food", label: "Food" },
  { key: "water", label: "Water" },
  { key: "resupply", label: "Resupply" },
  { key: "dangerous", label: "Dangerous sections" },
  { key: "rejectedClimbs", label: "Rejected climbs (debug)" },
];
