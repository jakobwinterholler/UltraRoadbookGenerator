import type { ZonePoiOption } from "../api";
import type { TimeMode } from "../planning/types";
import type { TimeWindowId } from "../planning/timeWindows";
import { getStopAvailability } from "../planning/stopAvailability";
import {
  categoryEmoji,
  formatStarRating,
  type RankedZonePoi,
} from "../planning/hubRecommendations";
import {
  formatHoursVisual,
  poiReliabilityPresentation,
} from "../planning/stopPresentation";
import { googleMapsUrl } from "./stopQuickActions";
import { formatOffRouteDistance, formatPoiName } from "./poiUi";

interface RecommendedStopRowProps {
  ranked: RankedZonePoi;
  roleLabel: string;
  timeWindowId: TimeWindowId | null;
  timeMode: TimeMode;
  compact?: boolean;
  onSelect?: (poi: ZonePoiOption) => void;
}

export default function RecommendedStopRow({
  ranked,
  roleLabel,
  timeWindowId,
  timeMode,
  compact = false,
  onSelect,
}: RecommendedStopRowProps) {
  const { poi, categoryLabel, categoryKey } = ranked;
  const reliability = poiReliabilityPresentation(poi.score);
  const hours = formatHoursVisual(poi.opening_hours, timeMode, poi.night_usability);
  const availability = getStopAvailability(poi, timeWindowId, timeMode);
  const closed = availability?.status === "closed";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{roleLabel}</p>
          <p className={`mt-0.5 font-medium text-ink ${compact ? "text-sm" : "text-base"}`}>
            <span className="mr-1.5" aria-hidden>
              {categoryEmoji(categoryKey)}
            </span>
            {formatPoiName(poi.name, poi.brand, {
              poiCategory: poi.poi_category,
              categoryKey,
            })}
          </p>
          <p className="mt-0.5 text-xs text-muted">{categoryLabel}</p>
        </div>
        <span className="shrink-0 text-xs tracking-tight text-muted" title={reliability.label}>
          {formatStarRating(reliability.stars)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{formatOffRouteDistance(poi.distance_off_route_m)} off route</span>
        <span>{hours.label}</span>
        {closed && <span className="text-red-700">{availability?.label}</span>}
      </div>

      {!compact && (
        <div className="mt-3">
          <a
            href={googleMapsUrl(poi.lat, poi.lon)}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-xs font-medium text-accent hover:text-accent/80"
          >
            Google Maps
          </a>
        </div>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(poi)}
        className={`w-full rounded-lg py-3 text-left transition hover:bg-canvas/80 ${
          closed ? "opacity-60" : ""
        } ${compact ? "px-1" : "px-2"}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`py-3 ${compact ? "px-1" : "px-2"} ${closed ? "opacity-60" : ""}`}>{content}</div>
  );
}
