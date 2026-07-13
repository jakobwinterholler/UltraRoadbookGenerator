import type { RoadbookResult, ResupplyZone } from "../api";
import type { RouteHighlight } from "./routeHighlights";
import {
  resolveBriefingHighlight,
  type KmRangeSelection,
} from "./useRouteWorkspaceSelection";
import { findNearestTrackIndex } from "../components/routeUtils";

export interface BriefingActionHandlers {
  onSelectClimb: (climbId: string) => void;
  onSelectKmRange: (range: KmRangeSelection) => void;
  onSelectSurface: (category: string) => void;
  onClearEntitySelection: () => void;
  setActiveIndex: (index: number) => void;
}

export function applyBriefingHighlight(
  highlight: RouteHighlight,
  result: RoadbookResult,
  zones: ResupplyZone[],
  totalKm: number,
  handlers: BriefingActionHandlers,
): void {
  const action = resolveBriefingHighlight(highlight.id, result, zones, totalKm);
  if (!action) {
    return;
  }

  if (action.onSelectClimb) {
    handlers.onSelectClimb(action.onSelectClimb);
  }
  if (action.onSelectKmRange) {
    handlers.onSelectKmRange(action.onSelectKmRange);
  }
  if (action.onSelectSurface) {
    handlers.onSelectSurface(action.onSelectSurface);
  }
  if (action.onJumpKm !== undefined) {
    handlers.onClearEntitySelection();
    handlers.setActiveIndex(findNearestTrackIndex(result.route.track_points, action.onJumpKm));
  }
}
