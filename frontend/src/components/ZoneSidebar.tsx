import { forwardRef, useEffect, useMemo, useRef } from "react";
import type { AppTab, ResupplyZone, ZonePoiOption } from "../api";
import type { OverlayMode, TimeMode, ZoneDensityMode } from "../planning/types";
import { zoneIsNightUseful, zoneMinDetourM } from "../planning/zonePresentation";
import { zoneAvailability } from "../planning/stopAvailability";
import type { StopSelection } from "../planning/stopSelection";
import { usePlanningAssumptions } from "../planning/usePlanningAssumptions";
import StopDetailPanel from "./StopDetailPanel";
import OffRouteBadge from "./OffRouteBadge";
import AvailabilityBadge from "./AvailabilityBadge";
import VerificationStatusBadge from "./verification/VerificationStatusBadge";
import { formatKm, zoneHasCategory, zonePrimaryName } from "./routeInsights";

interface ZoneSidebarProps {
  zones: ResupplyZone[];
  totalZones: number;
  totalKm: number;
  selectedZoneId: number | null;
  detailSelection: StopSelection;
  overlay: OverlayMode;
  timeMode: TimeMode;
  zoneDensity: ZoneDensityMode;
  showOsmTags: boolean;
  onSelectZone: (zoneId: number) => void;
  onDetailSelectionChange: (selection: StopSelection) => void;
  onCloseDetail: () => void;
}

function ServiceDot({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        active ? "bg-accent/10 text-accent" : "bg-canvas text-muted/70"
      }`}
    >
      {label}
    </span>
  );
}

const CompactZoneRow = forwardRef(function CompactZoneRow(
  {
    zone,
    gapKm,
    selected,
    dimmed,
    timeMode,
    onSelect,
  }: {
    zone: ResupplyZone;
    gapKm: number | null;
    selected: boolean;
    dimmed: boolean;
    timeMode: TimeMode;
    onSelect: () => void;
  },
  ref: React.Ref<HTMLButtonElement>,
) {
  const { arrivalTimeWindow } = usePlanningAssumptions();
  const food = zonePrimaryName(zone, "food");
  const water = zonePrimaryName(zone, "water");
  const fuel = zonePrimaryName(zone, "fuel");
  const availability = zoneAvailability(zone, arrivalTimeWindow, timeMode);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? "border-accent bg-accent/[0.04] ring-1 ring-accent/20"
          : "border-line bg-card hover:border-accent/25"
      } ${dimmed ? "opacity-45" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <VerificationStatusBadge zoneId={zone.zone_id} showLabel={false} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-ink">{zone.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {formatKm(zone.distance_along_km, 1)}
              </span>
            </div>
            <OffRouteBadge meters={zoneMinDetourM(zone)} tone={zone.accessibility_tone} />
          </div>

          {availability && (
            <div className="mt-2">
              <AvailabilityBadge availability={availability} />
            </div>
          )}

          <div className="mt-2 flex gap-1">
            <ServiceDot label="Food" active={zoneHasCategory(zone, "food")} />
            <ServiceDot label="Water" active={zoneHasCategory(zone, "water")} />
            <ServiceDot label="Fuel" active={zoneHasCategory(zone, "fuel")} />
          </div>

          {(food || water || fuel) && (
            <p className="mt-2 truncate text-xs text-muted">
              {[food, water, fuel].filter(Boolean).join(" · ")}
            </p>
          )}

          {gapKm !== null && gapKm >= 20 && (
            <p className={`mt-2 text-xs ${gapKm >= 40 ? "font-medium text-red-700" : "text-muted"}`}>
              {formatKm(gapKm, 0)} to next stop
            </p>
          )}

          {timeMode === "night" && (
            <p className="mt-1 text-[11px] text-emerald-700">
              {zoneIsNightUseful(zone) ? "Night-usable" : "Unlikely at night"}
            </p>
          )}
        </div>
      </div>
    </button>
  );
});

export default function ZoneSidebar({
  zones,
  totalZones,
  totalKm,
  selectedZoneId,
  detailSelection,
  overlay,
  timeMode,
  zoneDensity,
  showOsmTags,
  onSelectZone,
  onDetailSelectionChange,
  onCloseDetail,
}: ZoneSidebarProps) {
  const { arrivalTimeWindow } = usePlanningAssumptions();

  const gapsByZone = useMemo(() => {
    const sorted = [...zones].sort((a, b) => a.distance_along_km - b.distance_along_km);
    const map = new Map<number, number | null>();
    for (let index = 0; index < sorted.length; index += 1) {
      const next = sorted[index + 1];
      map.set(sorted[index].zone_id, next ? next.distance_along_km - sorted[index].distance_along_km : null);
    }
    return map;
  }, [zones]);

  const selectedZone = zones.find((zone) => zone.zone_id === selectedZoneId) ?? null;
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedZoneId === null) {
      return;
    }
    selectedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedZoneId]);

  const modeSummary =
    timeMode === "night"
      ? "Night-usable stops"
      : overlay === "surface"
        ? "Stops on surface view"
        : overlay === "resupply"
          ? "Stops on resupply view"
          : "Stops along route";

  function zoneDimmed(zone: ResupplyZone): boolean {
    if (!arrivalTimeWindow) {
      return false;
    }
    const availability = zoneAvailability(zone, arrivalTimeWindow, timeMode);
    return availability?.status === "closed";
  }

  function handleSelectPoi(poi: ZonePoiOption) {
    onDetailSelectionChange({
      kind: "poi",
      poi,
      zone: selectedZone,
    });
  }

  function handleBackToZone() {
    if (selectedZone) {
      onDetailSelectionChange({ kind: "zone", zone: selectedZone });
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{modeSummary}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {zones.length} shown · {totalZones} total · avg every{" "}
          {zones.length > 0 ? formatKm(totalKm / zones.length, 0) : "—"} · {zoneDensity} mode
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {zones.map((zone) => (
          <CompactZoneRow
            key={zone.zone_id}
            ref={selectedZoneId === zone.zone_id ? selectedRowRef : undefined}
            zone={zone}
            gapKm={gapsByZone.get(zone.zone_id) ?? null}
            selected={selectedZoneId === zone.zone_id}
            dimmed={zoneDimmed(zone)}
            timeMode={timeMode}
            onSelect={() => onSelectZone(zone.zone_id)}
          />
        ))}
      </div>

      {detailSelection && (
        <div className="max-h-[55vh] overflow-y-auto border-t border-line pt-3">
          <StopDetailPanel
            selection={detailSelection}
            timeWindowId={arrivalTimeWindow}
            timeMode={timeMode}
            showOsmTags={showOsmTags}
            onClose={onCloseDetail}
            onSelectPoi={handleSelectPoi}
            onBackToZone={detailSelection.kind === "poi" ? handleBackToZone : undefined}
          />
        </div>
      )}
    </aside>
  );
}

export function sidebarShowsOsmTags(_activeTab: AppTab): boolean {
  return false;
}
