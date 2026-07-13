export type FuelShopConfidence = "confirmed" | "likely" | "unknown" | "unlikely";

export interface FuelShopPresentation {
  confidence: FuelShopConfidence;
  label: string;
}

const CONFIRMED_SHOP_VALUES = new Set([
  "convenience",
  "kiosk",
  "yes",
  "general",
  "supermarket",
  "variety_store",
  "newsagent",
  "bakery",
  "deli",
  "greengrocer",
]);

const LIKELY_SHOP_BRANDS = new Set([
  "repsol",
  "galp",
  "cepsa",
  "moeve",
  "bp",
  "shell",
  "total",
  "totalenergies",
  "q8",
  "petronor",
  "esso",
  "eni",
  "agip",
  "avia",
  "omv",
  "carrefour",
  "simply",
  "alcampo",
  "petrocat",
  "petrolis",
  "esclatoil",
]);

export function assessFuelShopFromTags(input: {
  poiCategory: string;
  tags: Record<string, string>;
  name?: string | null;
  brand?: string | null;
  fuelShopConfidence?: string | null;
  fuelShopLabel?: string | null;
}): FuelShopPresentation | null {
  if (input.poiCategory !== "Gas station") {
    return null;
  }

  if (input.fuelShopLabel && input.fuelShopConfidence) {
    return {
      confidence: input.fuelShopConfidence as FuelShopConfidence,
      label: input.fuelShopLabel,
    };
  }

  const tags = input.tags;
  const shopValues = Object.entries(tags)
    .filter(([key]) => key === "shop" || key.startsWith("shop:"))
    .map(([, value]) => value.trim().toLowerCase());

  if (shopValues.some((value) => value === "no" || value === "none")) {
    return { confidence: "unlikely", label: "Fuel only" };
  }

  if (
    shopValues.some((value) => CONFIRMED_SHOP_VALUES.has(value)) ||
    tags.kiosk?.toLowerCase() === "yes" ||
    (tags.fast_food && !["no", "none"].includes(tags.fast_food.toLowerCase()))
  ) {
    return { confidence: "confirmed", label: "Shop confirmed" };
  }

  const brandCandidates = [input.brand, tags.brand, tags.operator]
    .filter(Boolean)
    .map((value) => value!.trim().toLowerCase());
  if (brandCandidates.some((value) => LIKELY_SHOP_BRANDS.has(value))) {
    return { confidence: "likely", label: "Shop likely" };
  }

  const combined = `${input.name ?? ""} ${input.brand ?? ""}`.toLowerCase();
  if ([" shop", " store", "express", "market", "minimarket"].some((hint) => combined.includes(hint))) {
    return { confidence: "likely", label: "Shop likely" };
  }

  return { confidence: "unknown", label: "Shop unknown" };
}

export function fuelShopBadgeClass(confidence: FuelShopConfidence | string | null | undefined): string {
  switch (confidence) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-800";
    case "likely":
      return "bg-sky-50 text-sky-800";
    case "unlikely":
      return "bg-red-50 text-red-800";
    case "unknown":
    default:
      return "bg-amber-50 text-amber-900";
  }
}
