export interface LiveTrackPoint {
  lat: number;
  lon: number;
  km: number;
}

export interface LiveSurfaceSegment {
  start_km: number;
  end_km: number;
  color: string;
}

export interface LiveClimb {
  id: string;
  start_km: number;
  end_km: number;
}

export interface LivePoi {
  lat: number;
  lon: number;
}

export interface LiveZone {
  zone_id: number;
  lat: number;
  lon: number;
}

export interface AnalysisLivePreview {
  track_points: LiveTrackPoint[];
  bounds: { south: number; west: number; north: number; east: number };
  surface_segments: LiveSurfaceSegment[];
  climbs: LiveClimb[];
  pois: LivePoi[];
  zones: LiveZone[];
  surfaceReady: boolean;
  poisReady: boolean;
  zonesReady: boolean;
}

export function createEmptyLivePreview(): AnalysisLivePreview {
  return {
    track_points: [],
    bounds: { south: 0, west: 0, north: 0, east: 0 },
    surface_segments: [],
    climbs: [],
    pois: [],
    zones: [],
    surfaceReady: false,
    poisReady: false,
    zonesReady: false,
  };
}

export function trackPositionsInKmRange(
  points: LiveTrackPoint[],
  startKm: number,
  endKm: number,
): [number, number][] {
  const positions = points
    .filter((point) => point.km >= startKm && point.km <= endKm)
    .map((point) => [point.lat, point.lon] as [number, number]);

  if (positions.length >= 2) {
    return positions;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const midKm = (startKm + endKm) / 2;
  for (let index = 0; index < points.length; index += 1) {
    const distance = Math.abs(points[index].km - midKm);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  const sliceStart = Math.max(0, bestIndex - 1);
  const sliceEnd = Math.min(points.length - 1, bestIndex + 1);
  return points
    .slice(sliceStart, sliceEnd + 1)
    .map((point) => [point.lat, point.lon] as [number, number]);
}
