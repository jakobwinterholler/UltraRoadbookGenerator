import type { StopSelection } from "./stopSelection";

/** Future: rider-facing decision insights (e.g. "Should I refill before this climb?"). */
export type DecisionPriority = "critical" | "important" | "info";

export interface DecisionInsight {
  id: string;
  question: string;
  answer: string;
  detail?: string;
  priority: DecisionPriority;
}

/**
 * Decision panel view modes. Route workspace uses entity + idle today;
 * decision insights plug in later without restructuring the panel.
 */
export type DecisionPanelView =
  | { type: "idle" }
  | { type: "stop"; selection: StopSelection }
  | { type: "climb"; climbId: string }
  | { type: "candidate"; candidateId: string }
  | { type: "section"; startKm: number; endKm: number; label: string }
  | { type: "decisions"; insights: DecisionInsight[] };

export function hasEntitySelection(view: DecisionPanelView): boolean {
  return view.type !== "idle";
}
