export interface StopTypePresentation {
  emoji: string;
  label: string;
}

const STOP_TYPE_MAP: Record<string, StopTypePresentation> = {
  "Gas station": { emoji: "⛽", label: "Gas station" },
  Supermarket: { emoji: "🛒", label: "Supermarket" },
  "Small supermarket": { emoji: "🏪", label: "Small grocery" },
  "Mini supermarket": { emoji: "🏪", label: "Small grocery" },
  Bakery: { emoji: "🥐", label: "Bakery" },
  "Drinking water": { emoji: "🚰", label: "Fountain" },
  Café: { emoji: "☕", label: "Café" },
  "Convenience store": { emoji: "🥤", label: "Convenience store" },
  Restaurant: { emoji: "🍽", label: "Restaurant" },
  "Fast food": { emoji: "🍔", label: "Fast food" },
};

const CATEGORY_KEY_LABELS: Record<string, StopTypePresentation> = {
  food: { emoji: "🛒", label: "Food stop" },
  water: { emoji: "🚰", label: "Water" },
  fuel: { emoji: "⛽", label: "Gas station" },
  dining: { emoji: "☕", label: "Café" },
};

export function stopTypeFromCategory(
  poiCategory: string | undefined,
  categoryKey?: string,
): StopTypePresentation {
  if (poiCategory && STOP_TYPE_MAP[poiCategory]) {
    return STOP_TYPE_MAP[poiCategory];
  }
  if (poiCategory) {
    return { emoji: "📍", label: poiCategory };
  }
  if (categoryKey && CATEGORY_KEY_LABELS[categoryKey]) {
    return CATEGORY_KEY_LABELS[categoryKey];
  }
  return { emoji: "📍", label: "Resupply stop" };
}
