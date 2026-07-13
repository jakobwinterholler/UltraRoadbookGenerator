import { Polyline } from "react-leaflet";
import {
  ROUTE_GLOW_OPACITY,
  ROUTE_GLOW_WEIGHTS,
  ROUTE_STYLE,
  type RouteGlowVariant,
} from "./planningMapTheme";

interface RouteGlowLayersProps {
  positions: [number, number][];
  variant?: RouteGlowVariant;
}

export default function RouteGlowLayers({
  positions,
  variant = "primary",
}: RouteGlowLayersProps) {
  if (positions.length < 2) {
    return null;
  }

  const weights = ROUTE_GLOW_WEIGHTS[variant];
  const opacity = ROUTE_GLOW_OPACITY[variant];

  return (
    <>
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{
          color: ROUTE_STYLE.glow,
          weight: weights.glow,
          opacity: opacity.glow,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{
          color: ROUTE_STYLE.halo,
          weight: weights.halo,
          opacity: opacity.halo,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{
          color: ROUTE_STYLE.core,
          weight: weights.core,
          opacity: opacity.core,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    </>
  );
}
