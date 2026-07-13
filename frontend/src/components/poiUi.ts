import type { ZonePoiOption } from "../api";
import { stopTypeFromCategory } from "../planning/stopVerification/stopTypePresentation";

export interface PoiNameContext {
  poiCategory?: string | null;
  categoryKey?: string;
}

const POI_FALLBACK_LABELS: Record<string, string> = {
  "Gas station": "Fuel Station",
  Supermarket: "Supermarket",
  "Small supermarket": "Convenience Store",
  "Mini supermarket": "Convenience Store",
  Bakery: "Bakery",
  "Drinking water": "Public Fountain",
  Café: "Café",
  "Convenience store": "Convenience Store",
  Restaurant: "Restaurant",
  "Fast food": "Fast Food",
};

const CATEGORY_KEY_FALLBACK_LABELS: Record<string, string> = {
  food: "Supermarket",
  water: "Public Fountain",
  fuel: "Fuel Station",
  dining: "Café",
};

export function poiFriendlyFallbackName(context?: PoiNameContext): string {
  if (context?.poiCategory) {
    return POI_FALLBACK_LABELS[context.poiCategory] ?? context.poiCategory;
  }
  if (context?.categoryKey) {
    if (CATEGORY_KEY_FALLBACK_LABELS[context.categoryKey]) {
      return CATEGORY_KEY_FALLBACK_LABELS[context.categoryKey];
    }
    const fromKey = stopTypeFromCategory(undefined, context.categoryKey);
    return POI_FALLBACK_LABELS[fromKey.label] ?? fromKey.label;
  }
  return "Resupply stop";
}

export function formatPoiName(
  name: string | null,
  brand: string | null,
  context?: PoiNameContext,
): string {
  if (name) {
    return name;
  }
  if (brand) {
    return brand;
  }
  return poiFriendlyFallbackName(context);
}

export function formatOffRouteDistance(meters: number): string {
  return `${Math.round(meters)} m`;
}

export function accessibilityClass(tone: ZonePoiOption["accessibility_tone"]): string {
  switch (tone) {
    case "good":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "caution":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "warning":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "bad":
      return "bg-red-50 text-red-800 ring-red-200";
  }
}
