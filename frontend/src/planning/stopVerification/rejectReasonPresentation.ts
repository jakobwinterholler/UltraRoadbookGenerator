import type { StopRejectOption, StopRejectReason } from "./types";

/** Signals used by future scoring / hub-selection improvements. */
export type RejectAlgorithmTarget =
  | "fuel_shop_confidence"
  | "poi_visibility"
  | "hub_deduplication"
  | "osm_data_quality"
  | "route_accessibility"
  | "practicality_score"
  | "trust_score"
  | "opening_hours";

export interface RejectReasonMeta {
  label: string;
  targets: RejectAlgorithmTarget[];
}

export const REJECT_REASON_META: Record<StopRejectReason, RejectReasonMeta> = {
  too_large: { label: "Queue too long", targets: ["practicality_score"] },
  closed: { label: "Closed", targets: ["opening_hours", "practicality_score"] },
  too_much_detour: { label: "Too much detour", targets: ["route_accessibility", "practicality_score"] },
  not_practical: { label: "Doesn't look practical", targets: ["practicality_score"] },
  no_shop: { label: "No shop", targets: ["fuel_shop_confidence", "practicality_score"] },
  shop_uncertain: { label: "Not sure if it has a shop", targets: ["fuel_shop_confidence"] },
  not_in_street_view: {
    label: "Not found in Google Street View",
    targets: ["poi_visibility", "osm_data_quality"],
  },
  bike_not_accessible: {
    label: "Doesn't look accessible with a bike",
    targets: ["route_accessibility", "practicality_score"],
  },
  not_trustworthy: { label: "Doesn't look trustworthy", targets: ["trust_score", "practicality_score"] },
  permanently_closed: { label: "Permanently closed (if obvious)", targets: ["opening_hours", "osm_data_quality"] },
  duplicate_nearby: { label: "Duplicate / better option nearby", targets: ["hub_deduplication"] },
  fountain_not_found: {
    label: "Couldn't find the fountain",
    targets: ["osm_data_quality", "poi_visibility"],
  },
  fountain_unreliable: {
    label: "Looks unreliable / might be seasonal",
    targets: ["osm_data_quality", "practicality_score"],
  },
  fountain_not_accessible: {
    label: "Not accessible from the route",
    targets: ["route_accessibility", "practicality_score"],
  },
  other: { label: "Other", targets: ["practicality_score"] },
};

export interface RejectReasonGroup {
  id: string;
  label: string | null;
  reasons: StopRejectOption[];
}

const GENERAL_REASON_IDS: StopRejectReason[] = [
  "too_large",
  "closed",
  "too_much_detour",
  "not_practical",
];

const ALGORITHM_REASON_IDS: StopRejectReason[] = [
  "no_shop",
  "shop_uncertain",
  "not_in_street_view",
  "bike_not_accessible",
  "not_trustworthy",
  "permanently_closed",
  "duplicate_nearby",
];

const FOUNTAIN_REASON_IDS: StopRejectReason[] = [
  "fountain_not_found",
  "fountain_unreliable",
  "fountain_not_accessible",
];

function optionsFor(ids: StopRejectReason[]): StopRejectOption[] {
  return ids.map((id) => ({ id, label: REJECT_REASON_META[id].label }));
}

export function isFountainStop(poiCategory?: string | null, categoryKey?: string): boolean {
  return poiCategory === "Drinking water" || categoryKey === "water";
}

export function rejectReasonGroups(
  poiCategory?: string | null,
  categoryKey?: string,
): RejectReasonGroup[] {
  const groups: RejectReasonGroup[] = [
    { id: "general", label: null, reasons: optionsFor(GENERAL_REASON_IDS) },
    {
      id: "algorithm",
      label: "Help improve recommendations",
      reasons: optionsFor(ALGORITHM_REASON_IDS),
    },
  ];

  if (isFountainStop(poiCategory, categoryKey)) {
    groups.push({
      id: "fountain",
      label: "Fountain",
      reasons: optionsFor(FOUNTAIN_REASON_IDS),
    });
  }

  groups.push({ id: "other", label: null, reasons: optionsFor(["other"]) });
  return groups;
}

export function rejectAlgorithmTargets(reason: StopRejectReason): RejectAlgorithmTarget[] {
  return REJECT_REASON_META[reason].targets;
}
