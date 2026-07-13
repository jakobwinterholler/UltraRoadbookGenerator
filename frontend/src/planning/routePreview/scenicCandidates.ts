import type { RouteVisualization, TrackPoint } from "../../api";
import type { RoutePreviewCandidate } from "./types";

const WINDOW_KM = 12;
const SAMPLE_STEP = 8;

function pointsInRange(points: TrackPoint[], startKm: number, endKm: number): TrackPoint[] {
  return points.filter((point) => point.km >= startKm && point.km <= endKm);
}

function elevationAtKm(points: TrackPoint[], km: number): number | null {
  let best: TrackPoint | null = null;
  for (const point of points) {
    if (point.ele_m === null) {
      continue;
    }
    if (!best || Math.abs(point.km - km) < Math.abs(best.km - km)) {
      best = point;
    }
  }
  return best?.ele_m ?? null;
}

function minMaxElevation(points: TrackPoint[]): { min: number; max: number } | null {
  const values = points.map((point) => point.ele_m).filter((value): value is number => value !== null);
  if (values.length === 0) {
    return null;
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

function overlapsRange(
  startKm: number,
  endKm: number,
  occupied: Array<{ startKm: number; endKm: number }>,
  bufferKm: number,
): boolean {
  return occupied.some(
    (range) =>
      startKm - bufferKm <= range.endKm && endKm + bufferKm >= range.startKm,
  );
}

function detectSummitPanoramas(
  points: TrackPoint[],
  occupied: Array<{ startKm: number; endKm: number }>,
): RoutePreviewCandidate[] {
  const candidates: RoutePreviewCandidate[] = [];
  const totalKm = points[points.length - 1]?.km ?? 0;

  for (let km = WINDOW_KM; km <= totalKm - WINDOW_KM; km += SAMPLE_STEP) {
    const window = pointsInRange(points, km - WINDOW_KM, km + WINDOW_KM);
    const stats = minMaxElevation(window);
    const centerEle = elevationAtKm(points, km);
    if (!stats || centerEle === null || centerEle < stats.max - 15) {
      continue;
    }

    const prominence = stats.max - stats.min;
    if (prominence < 320 || centerEle < 700) {
      continue;
    }

    const startKm = Math.max(0, km - 4);
    const endKm = Math.min(totalKm, km + 4);
    if (overlapsRange(startKm, endKm, occupied, 10)) {
      continue;
    }

    candidates.push({
      id: `scenery-summit-${Math.round(km)}`,
      type: "scenery",
      title: "Mountain panorama",
      description: `High ridge around km ${Math.round(km)} · ${Math.round(centerEle)} m with ${Math.round(prominence)} m of relief nearby`,
      whyChosen: "Strong elevation contrast — a memorable vista moment, not just a statistics peak",
      startKm,
      endKm,
      focusKm: km,
      priority: 3,
      editorialScore: prominence + centerEle * 0.15,
    });
  }

  return candidates
    .sort((left, right) => right.editorialScore - left.editorialScore)
    .slice(0, 4);
}

function detectLongDescents(
  points: TrackPoint[],
  occupied: Array<{ startKm: number; endKm: number }>,
): RoutePreviewCandidate[] {
  const candidates: RoutePreviewCandidate[] = [];
  if (points.length < 40) {
    return candidates;
  }

  let segmentStart = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const isDescent =
      previous.ele_m !== null &&
      current.ele_m !== null &&
      current.ele_m <= previous.ele_m - 0.5;

    const atEnd = index === points.length - 1;
    if (!isDescent && !atEnd) {
      continue;
    }

    const endIndex = atEnd && isDescent ? index : index - 1;
    const startPoint = points[segmentStart];
    const endPoint = points[endIndex];
    if (
      startPoint.ele_m === null ||
      endPoint.ele_m === null ||
      endIndex <= segmentStart + 5
    ) {
      segmentStart = isDescent ? segmentStart : index;
      continue;
    }

    const distanceKm = endPoint.km - startPoint.km;
    const lossM = startPoint.ele_m - endPoint.ele_m;
    if (distanceKm >= 18 && lossM >= 520) {
      const startKm = startPoint.km;
      const endKm = endPoint.km;
      if (!overlapsRange(startKm, endKm, occupied, 12)) {
        candidates.push({
          id: `valley-descent-${Math.round(startKm)}`,
          type: "valley",
          title: "Long descent",
          description: `${distanceKm.toFixed(0)} km downhill · −${Math.round(lossM)} m — the landscape opens below you`,
          whyChosen: "Extended descending section — cinematic flow and a sense of arrival into new terrain",
          startKm,
          endKm,
          focusKm: (startKm + endKm) / 2,
          priority: 3,
          editorialScore: lossM + distanceKm * 8,
        });
      }
    }

    segmentStart = isDescent ? segmentStart : index;
  }

  return candidates.sort((left, right) => right.editorialScore - left.editorialScore).slice(0, 3);
}

function detectLowlandCorridors(
  points: TrackPoint[],
  occupied: Array<{ startKm: number; endKm: number }>,
): RoutePreviewCandidate[] {
  const candidates: RoutePreviewCandidate[] = [];
  let runStart: number | null = null;
  let runEnd: number | null = null;
  let runElevations: number[] = [];

  function flushRun() {
    if (runStart === null || runEnd === null || runElevations.length === 0) {
      return;
    }
    const distanceKm = runEnd - runStart;
    if (distanceKm < 8) {
      runStart = null;
      runEnd = null;
      runElevations = [];
      return;
    }

    const avgEle = runElevations.reduce((sum, value) => sum + value, 0) / runElevations.length;
    const isCoastalPlain = avgEle < 35;
    const startKm = runStart;
    const endKm = runEnd;

    if (!overlapsRange(startKm, endKm, occupied, 10)) {
      candidates.push({
        id: `${isCoastalPlain ? "coastline" : "scenery-lowland"}-${Math.round(startKm)}`,
        type: isCoastalPlain ? "coastline" : "scenery",
        title: isCoastalPlain ? "Coastal plain" : "Open lowland",
        description: isCoastalPlain
          ? `${distanceKm.toFixed(0)} km near sea level — flat, open riding with big-sky feeling`
          : `${distanceKm.toFixed(0)} km in open low terrain — a calmer visual chapter between the mountains`,
        whyChosen: isCoastalPlain
          ? "Sustained low elevation — often reads as coastline or river delta on film"
          : "Deliberate breathing room — landscape scale without climb or resupply drama",
        startKm,
        endKm,
        focusKm: (startKm + endKm) / 2,
        priority: 2,
        editorialScore: distanceKm * (isCoastalPlain ? 14 : 10) + (40 - avgEle),
      });
    }

    runStart = null;
    runEnd = null;
    runElevations = [];
  }

  for (const point of points) {
    if (point.ele_m === null || point.ele_m > 95) {
      flushRun();
      continue;
    }
    if (runStart === null) {
      runStart = point.km;
    }
    runEnd = point.km;
    runElevations.push(point.ele_m);
  }
  flushRun();

  return candidates
    .sort((left, right) => right.editorialScore - left.editorialScore)
    .slice(0, 3);
}

export function detectScenicCandidates(
  route: RouteVisualization,
  occupied: Array<{ startKm: number; endKm: number }> = [],
): RoutePreviewCandidate[] {
  const points = route.track_points;
  if (points.length < 20) {
    return [];
  }

  const summit = detectSummitPanoramas(points, occupied);
  const descents = detectLongDescents(points, [...occupied, ...summit.map((item) => item)]);
  const lowland = detectLowlandCorridors(points, [
    ...occupied,
    ...summit.map((item) => item),
    ...descents.map((item) => item),
  ]);

  const merged = [...summit, ...descents, ...lowland];
  const byId = new Map<string, RoutePreviewCandidate>();
  for (const candidate of merged) {
    const existing = byId.get(candidate.id);
    if (!existing || candidate.editorialScore > existing.editorialScore) {
      byId.set(candidate.id, candidate);
    }
  }

  return [...byId.values()].sort((left, right) => right.editorialScore - left.editorialScore);
}
