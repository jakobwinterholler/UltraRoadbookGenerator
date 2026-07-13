import type { ClimbRoadbook } from "../../planning/climbRoadbook";
import { formatClimbingTime } from "../../planning/climbRoadbook";

interface ClimbPlanningInsightsProps {
  roadbook: ClimbRoadbook;
}

function gapLabel(km: number | null): string {
  if (km === null) {
    return "None within 120 km";
  }
  if (km === 0) {
    return "On the climb";
  }
  return `${Math.round(km)} km`;
}

export default function ClimbPlanningInsights({ roadbook }: ClimbPlanningInsightsProps) {
  return (
    <section>
      <h3 className="text-sm font-medium text-ink">Planning insights</h3>
      <p className="mt-3 text-sm font-medium text-ink">Should I refill before this climb?</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{roadbook.refillAdvice}</p>

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-6 border-b border-line/40 pb-3">
          <dt className="text-muted">Last reliable water before climb</dt>
          <dd className="shrink-0 font-medium tabular-nums text-ink">
            {gapLabel(roadbook.prevReliableWaterKm)}
          </dd>
        </div>
        <div className="flex justify-between gap-6 border-b border-line/40 pb-3">
          <dt className="text-muted">First reliable water after summit</dt>
          <dd className="shrink-0 font-medium tabular-nums text-ink">
            {gapLabel(roadbook.nextReliableWaterKm)}
          </dd>
        </div>
        <div className="flex justify-between gap-6 border-b border-line/40 pb-3">
          <dt className="text-muted">First food after summit</dt>
          <dd className="shrink-0 font-medium tabular-nums text-ink">
            {gapLabel(roadbook.nextReliableFoodKm)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted">Estimated climbing time</dt>
          <dd className="shrink-0 font-medium tabular-nums text-ink">
            ~{formatClimbingTime(roadbook.estimatedClimbingHours)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
