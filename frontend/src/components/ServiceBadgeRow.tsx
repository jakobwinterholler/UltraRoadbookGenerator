import type { ResupplyZone } from "../api";
import { zoneHasCategory } from "./routeInsights";
import { zoneMinDetourM } from "../planning/zonePresentation";
import type { HoursVisual } from "../planning/stopPresentation";
import type { ReliabilityPresentation } from "../planning/stopPresentation";
import HoursBadge from "./HoursBadge";
import ReliabilityBadge from "./ReliabilityBadge";

interface ServiceBadgeRowProps {
  zone: ResupplyZone;
  reliability: ReliabilityPresentation;
  hours: HoursVisual;
}

export default function ServiceBadgeRow({ zone, reliability, hours }: ServiceBadgeRowProps) {
  const detourM = zoneMinDetourM(zone);

  return (
    <div className="flex flex-wrap gap-2">
      {zoneHasCategory(zone, "food") && (
        <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink">🛒 Food</span>
      )}
      {zoneHasCategory(zone, "water") && (
        <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink">💧 Water</span>
      )}
      {zoneHasCategory(zone, "fuel") && (
        <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink">⛽ Fuel</span>
      )}
      <HoursBadge hours={hours} />
      <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink">
        📍 {detourM <= 20 ? "On route" : `${Math.round(detourM)} m off`}
      </span>
      <ReliabilityBadge reliability={reliability} size="sm" />
    </div>
  );
}
