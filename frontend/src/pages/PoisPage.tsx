import { useState } from "react";
import type { AppTab, PoiRow, ResupplyZone } from "../api";
import PoiTable from "../components/PoiTable";
import StopDetailPanel from "../components/StopDetailPanel";
import { sidebarShowsOsmTags } from "../components/ZoneSidebar";
import type { StopSelection } from "../planning/stopSelection";
import { findZoneForPoi } from "../planning/stopSelection";
import { usePlanning } from "../planning/PlanningContext";
import { usePlanningAssumptions } from "../planning/usePlanningAssumptions";

interface PoisPageProps {
  pois: PoiRow[];
  zones: ResupplyZone[];
  activeTab: AppTab;
}

export default function PoisPage({ pois, zones, activeTab }: PoisPageProps) {
  const { timeMode } = usePlanning();
  const { arrivalTimeWindow } = usePlanningAssumptions();
  const [detailSelection, setDetailSelection] = useState<StopSelection>(null);

  function handleSelectPoi(poi: PoiRow) {
    setDetailSelection({
      kind: "poi",
      poi,
      zone: findZoneForPoi(zones, poi),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Points of Interest</h2>
        <p className="mt-1 text-sm text-muted">
          Click any POI for full details. Zoned POIs are grouped into Resupply Zones on the Resupply tab.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <PoiTable pois={pois} selectedPoiKey={detailSelection?.kind === "poi" ? `${detailSelection.poi.osm_type}-${detailSelection.poi.osm_id}` : null} onSelectPoi={handleSelectPoi} />
        <div className="xl:sticky xl:top-6 xl:self-start">
          {detailSelection ? (
            <StopDetailPanel
              selection={detailSelection}
              timeWindowId={arrivalTimeWindow}
              timeMode={timeMode}
              showOsmTags={sidebarShowsOsmTags(activeTab)}
              onClose={() => setDetailSelection(null)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-card/60 p-6 text-sm text-muted">
              Select a POI to inspect opening hours, contact details, and OSM tags.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
