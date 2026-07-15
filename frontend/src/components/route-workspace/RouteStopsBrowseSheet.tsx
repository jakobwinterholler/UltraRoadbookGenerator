import type { ResupplyZone } from "../../api";
import type { RouteHighlight } from "../../planning/routeHighlights";
import type { TimeMode, ZoneDensityMode } from "../../planning/types";
import { zoneAvailability } from "../../planning/stopAvailability";
import { usePlanningAssumptions } from "../../planning/usePlanningAssumptions";
import PlanningDetailSheet from "../planning/PlanningDetailSheet";
import RouteBriefing from "../route-workspace/RouteBriefing";
import ZoneListRow from "../route-workspace/ZoneListRow";

interface RouteStopsBrowseSheetProps {
  open: boolean;
  onClose: () => void;
  zones: ResupplyZone[];
  totalZones: number;
  zoneDensity: ZoneDensityMode;
  timeMode: TimeMode;
  selectedZoneId: number | null;
  briefingHighlights: RouteHighlight[];
  onSelectZone: (zoneId: number) => void;
  onHoverZone?: (zoneId: number | null) => void;
  onSelectHighlight: (highlight: RouteHighlight) => void;
  onViewFullBriefing: () => void;
}

export default function RouteStopsBrowseSheet({
  open,
  onClose,
  zones,
  totalZones,
  zoneDensity,
  timeMode,
  selectedZoneId,
  briefingHighlights,
  onSelectZone,
  onHoverZone,
  onSelectHighlight,
  onViewFullBriefing,
}: RouteStopsBrowseSheetProps) {
  const { arrivalTimeWindow } = usePlanningAssumptions();

  function zoneDimmed(zone: ResupplyZone): boolean {
    if (!arrivalTimeWindow) {
      return false;
    }
    const availability = zoneAvailability(zone, arrivalTimeWindow, timeMode);
    return availability?.status === "closed";
  }

  function handleSelectZone(zoneId: number) {
    onSelectZone(zoneId);
    onClose();
  }

  return (
    <PlanningDetailSheet
      open={open}
      title="Planning stops"
      subtitle={`${zones.length} shown · ${totalZones} total · ${zoneDensity} view`}
      onClose={onClose}
    >
      <div className="space-y-5">
        <RouteBriefing
          highlights={briefingHighlights}
          onSelectHighlight={(highlight) => {
            onSelectHighlight(highlight);
            onClose();
          }}
          onViewFullBriefing={() => {
            onViewFullBriefing();
            onClose();
          }}
        />

        <div>
          <h3 className="text-sm font-semibold text-ink">Along the route</h3>
          <div className="mt-2 divide-y divide-line/50">
            {zones.map((zone) => (
              <ZoneListRow
                key={zone.zone_id}
                zone={zone}
                selected={selectedZoneId === zone.zone_id}
                dimmed={zoneDimmed(zone)}
                timeMode={timeMode}
                onSelect={() => handleSelectZone(zone.zone_id)}
                onHover={onHoverZone}
              />
            ))}
          </div>
        </div>
      </div>
    </PlanningDetailSheet>
  );
}
