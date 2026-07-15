import { forwardRef } from "react";
import type { ResupplyZone } from "../../api";
import { usePlanningAssumptions } from "../../planning/usePlanningAssumptions";
import { zoneAvailability } from "../../planning/stopAvailability";
import { zoneMinDetourM } from "../../planning/zonePresentation";
import { formatKm, zoneHasCategory, zonePrimaryName } from "../routeInsights";
import VerificationStatusBadge from "../verification/VerificationStatusBadge";

interface ZoneListRowProps {
  zone: ResupplyZone;
  selected: boolean;
  dimmed: boolean;
  timeMode: "day" | "night";
  onSelect: () => void;
  onHover?: (zoneId: number | null) => void;
}

const ZoneListRow = forwardRef<HTMLButtonElement, ZoneListRowProps>(function ZoneListRow(
  { zone, selected, dimmed, timeMode, onSelect, onHover },
  ref,
) {
  const { arrivalTimeWindow } = usePlanningAssumptions();
  const food = zonePrimaryName(zone, "food");
  const water = zonePrimaryName(zone, "water");
  const availability = zoneAvailability(zone, arrivalTimeWindow, timeMode);
  const detourM = zoneMinDetourM(zone);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover?.(zone.zone_id)}
      onMouseLeave={() => onHover?.(null)}
      className={`w-full border-l-2 py-2.5 pl-3 pr-1 text-left transition ${
        selected
          ? "border-l-accent bg-accent/[0.04]"
          : "border-l-transparent hover:bg-canvas/70"
      } ${dimmed ? "opacity-45" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <VerificationStatusBadge zoneId={zone.zone_id} showLabel={false} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-ink">{zone.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {formatKm(zone.distance_along_km, 1)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            {zoneHasCategory(zone, "food") && <span>Food</span>}
            {zoneHasCategory(zone, "water") && <span>Water</span>}
            {zoneHasCategory(zone, "fuel") && <span>Fuel</span>}
            {detourM > 20 && <span>{Math.round(detourM)} m off route</span>}
            {availability?.status === "closed" && (
              <span className="text-red-700">{availability.label}</span>
            )}
          </div>

          {(food || water) && (
            <p className="mt-1 truncate text-xs text-muted">
              {[food, water].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </button>
  );
});

export default ZoneListRow;
