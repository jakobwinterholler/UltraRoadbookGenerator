import { TileLayer } from "react-leaflet";
import type { MapStyleTileLayer } from "./mapStyleCatalog";

interface EvaluationBasemapLayersProps {
  id: string;
  attribution: string;
  layers: MapStyleTileLayer[];
}

export default function EvaluationBasemapLayers({
  id,
  attribution,
  layers,
}: EvaluationBasemapLayersProps) {
  return (
    <>
      {layers.map((layer, index) => (
        <TileLayer
          key={`${id}-${index}`}
          url={layer.url}
          attribution={index === layers.length - 1 ? attribution : undefined}
          opacity={layer.opacity}
          maxNativeZoom={layer.maxNativeZoom}
        />
      ))}
    </>
  );
}
