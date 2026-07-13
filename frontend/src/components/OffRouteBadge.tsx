import type { ZonePoiOption } from "../api";
import { accessibilityClass, formatOffRouteDistance } from "./poiUi";

export default function OffRouteBadge({
  meters,
  tone,
}: {
  meters: number;
  tone: ZonePoiOption["accessibility_tone"];
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${accessibilityClass(tone)}`}
    >
      {formatOffRouteDistance(meters)}
    </span>
  );
}
