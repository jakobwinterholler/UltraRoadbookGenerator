import type { AppTab } from "../api";

/** Cross-tab navigation with pre-selected context. Consumed by the destination screen. */
export type PlanningIntent =
  | { type: "briefing-highlight"; highlightId: string; tab?: AppTab }
  | { type: "select-climb"; climbId: string; tab?: AppTab }
  | {
      type: "select-km-range";
      startKm: number;
      endKm: number;
      label: string;
      surfaceCategory?: string;
      tab?: AppTab;
    }
  | {
      type: "surface-explore";
      surfaceCategory?: string;
      startKm?: number;
      endKm?: number;
      label?: string;
      tab?: AppTab;
    }
  | { type: "jump-km"; km: number; tab?: AppTab }
  | null;

export function briefingHighlightIntent(highlightId: string, tab: AppTab = "route"): PlanningIntent {
  return { type: "briefing-highlight", highlightId, tab };
}

export function selectClimbIntent(climbId: string, tab: AppTab = "route"): PlanningIntent {
  return { type: "select-climb", climbId, tab };
}

export function selectKmRangeIntent(
  startKm: number,
  endKm: number,
  label: string,
  tab: AppTab = "route",
): PlanningIntent {
  return { type: "select-km-range", startKm, endKm, label, tab };
}

export function surfaceExploreIntent(
  options: {
    surfaceCategory?: string;
    startKm?: number;
    endKm?: number;
    label?: string;
  },
  tab: AppTab = "route",
): PlanningIntent {
  return { type: "surface-explore", ...options, tab };
}

export function targetTabForIntent(intent: NonNullable<PlanningIntent>): AppTab {
  return intent.tab ?? "route";
}
