/** Fuel station shop assessment (mirrors src/gas_station_shop.py). */

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
  "department_store",
  "mall",
]);

const UNLIKELY_SHOP_VALUES = new Set(["no", "none"]);

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
  "euroshell",
  "intermarché",
  "intermarche",
  "carrefour",
  "simply",
  "alcampo",
  "petrocat",
  "petrolis",
  "esclatoil",
]);

const NAME_SHOP_HINTS = [" shop", " store", "express", "market", "minimarket", " convenience", " spar"];
const NAME_FUEL_ONLY_HINTS = [" fuel only", " pumps only", " unmanned", " solo gasolin"];

export interface FuelShopAssessment {
  confidence: "confirmed" | "likely" | "unknown" | "unlikely";
  label: string;
  scoreAdjustment: number;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function shopTagValues(tags: Record<string, string>): string[] {
  const values: string[] = [];
  for (const [key, raw] of Object.entries(tags)) {
    if (key === "shop" || key.startsWith("shop:")) {
      values.push(raw.trim().toLowerCase());
    }
  }
  return values;
}

function hasConfirmedShopTag(tags: Record<string, string>): boolean {
  for (const value of shopTagValues(tags)) {
    if (CONFIRMED_SHOP_VALUES.has(value)) {
      return true;
    }
  }
  const kiosk = tags.kiosk?.trim().toLowerCase();
  if (kiosk === "yes" || kiosk === "true" || kiosk === "1") {
    return true;
  }
  const fastFood = tags.fast_food?.trim().toLowerCase();
  return Boolean(fastFood && !UNLIKELY_SHOP_VALUES.has(fastFood));
}

function brandSuggestsShop(tags: Record<string, string>, brand: string | null | undefined): boolean {
  const candidates = new Set(
    [normalized(brand), normalized(tags.brand), normalized(tags.operator)].filter(Boolean),
  );
  return [...candidates].some((candidate) => LIKELY_SHOP_BRANDS.has(candidate));
}

function nameSuggestsShop(name: string | null | undefined, brand: string | null | undefined): boolean {
  const combined = `${normalized(name)} ${normalized(brand)}`;
  return NAME_SHOP_HINTS.some((hint) => combined.includes(hint));
}

function nameSuggestsFuelOnly(name: string | null | undefined): boolean {
  const combined = normalized(name);
  return NAME_FUEL_ONLY_HINTS.some((hint) => combined.includes(hint));
}

export function assessFuelShop(input: {
  category: string;
  tags?: Record<string, string> | null;
  name?: string | null;
  brand?: string | null;
}): FuelShopAssessment | null {
  if (input.category !== "Gas station") {
    return null;
  }
  const tags = input.tags ?? {};
  if (nameSuggestsFuelOnly(input.name)) {
    return { confidence: "unlikely", label: "Fuel only", scoreAdjustment: -6 };
  }
  if (hasConfirmedShopTag(tags)) {
    return { confidence: "confirmed", label: "Fuel + shop", scoreAdjustment: 14 };
  }
  if (brandSuggestsShop(tags, input.brand) || nameSuggestsShop(input.name, input.brand)) {
    return { confidence: "likely", label: "Likely shop", scoreAdjustment: 10 };
  }
  const unlikelyShop = shopTagValues(tags).some((value) => UNLIKELY_SHOP_VALUES.has(value));
  if (unlikelyShop || tags["fuel:shop"] === "no") {
    return { confidence: "unlikely", label: "Unlikely shop", scoreAdjustment: -4 };
  }
  return { confidence: "unknown", label: "Fuel", scoreAdjustment: 4 };
}
