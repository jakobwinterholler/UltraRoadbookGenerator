import type { ClimbCandidateRow, ClimbRow, ResupplyZone, ZonePoiOption } from "../api";
import type { StopSelection } from "./stopSelection";

export interface RouteSelectionState {
  activeIndex: number | null;
  selectedZoneId: number | null;
  selectedClimbId: string | null;
  selectedCandidateId: string | null;
  detailSelection: StopSelection;
}

export function climbById(climbs: ClimbRow[], climbId: string | null): ClimbRow | null {
  if (!climbId) {
    return null;
  }
  return climbs.find((climb) => climb.id === climbId) ?? null;
}

export function candidateById(
  candidates: ClimbCandidateRow[],
  candidateId: string | null,
): ClimbCandidateRow | null {
  if (!candidateId) {
    return null;
  }
  return candidates.find((candidate) => candidate.candidate_id === candidateId) ?? null;
}

export function poiSelection(
  poi: ZonePoiOption,
  zone: ResupplyZone,
): StopSelection {
  return { kind: "poi", poi, zone };
}
