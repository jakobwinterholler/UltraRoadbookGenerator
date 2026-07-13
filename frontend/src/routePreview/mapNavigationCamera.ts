import type maplibregl from "maplibre-gl";
import type { FlyoverSample } from "./mapFlyover";

/** True top-down — no perspective tilt. */
export const NAVIGATION_PITCH = 0;

/** Enough context to read roads and towns; not cinematic close-up. */
export const NAVIGATION_ZOOM = 13.5;

export interface NavigationCameraState {
  lng: number;
  lat: number;
  /** Direction of travel — map rotates so this points toward the top of the screen. */
  bearing: number;
}

/**
 * Strava / Google Maps navigation style:
 * rider centered, travel direction up, flat map.
 */
export function applyNavigationCamera(
  map: maplibregl.Map,
  state: NavigationCameraState,
  zoom: number = NAVIGATION_ZOOM,
): void {
  map.jumpTo({
    center: [state.lng, state.lat],
    bearing: state.bearing,
    pitch: NAVIGATION_PITCH,
    zoom,
  });
}

export function flyoverSampleToCamera(sample: FlyoverSample): NavigationCameraState {
  return {
    lng: sample.lng,
    lat: sample.lat,
    bearing: sample.bearing,
  };
}
