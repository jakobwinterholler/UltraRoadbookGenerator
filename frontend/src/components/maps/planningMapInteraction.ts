/**
 * Shared Leaflet interaction defaults for planning maps.
 * Wheel zoom is disabled so scrolling the page never accidentally zooms the map.
 * Touch pinch zoom stays enabled on interactive maps.
 */

export const PLANNING_MAP_INTERACTIVE_PROPS = {
  scrollWheelZoom: false,
  touchZoom: true,
  dragging: true,
  doubleClickZoom: true,
  zoomControl: true,
} as const;

/** Embedded context maps — fixed framing, no pan/zoom controls. */
export const PLANNING_MAP_STATIC_PROPS = {
  scrollWheelZoom: false,
  touchZoom: true,
  dragging: false,
  doubleClickZoom: false,
  zoomControl: false,
} as const;

/** Verify workflow maps use the same wheel behavior as planning context maps. */
export const VERIFY_MAP_STATIC_PROPS = PLANNING_MAP_STATIC_PROPS;
