import { TileLayer } from "react-leaflet";
import {
  PLANNING_BASEMAP_ATTRIBUTION,
  PLANNING_BASEMAP_URL,
  PLANNING_HILLSHADE_URL,
} from "./planningMapTheme";

interface PlanningTileLayerProps {
  showAttribution?: boolean;
}

export default function PlanningTileLayer({ showAttribution = true }: PlanningTileLayerProps) {
  return (
    <>
      <TileLayer
        url={PLANNING_HILLSHADE_URL}
        maxNativeZoom={13}
        opacity={0.2}
        attribution={undefined}
      />
      <TileLayer
        url={PLANNING_BASEMAP_URL}
        attribution={showAttribution ? PLANNING_BASEMAP_ATTRIBUTION : undefined}
      />
    </>
  );
}
