import type { ResupplyZone } from "../../api";
import type { RankedZonePoi } from "../hubRecommendations";
import { rejectAlgorithmTargets } from "./rejectReasonPresentation";
import type { StopRejectFeedbackContext, StopRejectReason } from "./types";

export function buildRejectFeedbackContext(
  zone: ResupplyZone,
  best: RankedZonePoi | null,
  reason: StopRejectReason,
): StopRejectFeedbackContext {
  return {
    zoneId: zone.zone_id,
    poiCategory: best?.poi.poi_category,
    categoryKey: best?.categoryKey,
    distanceAlongKm: zone.distance_along_km,
    distanceOffRouteM: best?.poi.distance_off_route_m,
    fuelShopConfidence: best?.poi.fuel_shop_confidence ?? undefined,
    poiName: best?.poi.name ?? best?.poi.brand ?? null,
    algorithmTargets: rejectAlgorithmTargets(reason),
  };
}
