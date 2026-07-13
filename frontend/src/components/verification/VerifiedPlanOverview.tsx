import { useState } from "react";
import type { ResupplyZone, RouteVisualization } from "../../api";
import type { VerifiedPlan } from "../../planning/stopVerification/verifiedPlan";
import type { VerifiedStopRecord } from "../../planning/stopVerification/types";
import VerifiedPlanMap from "./VerifiedPlanMap";
import VerifiedPlanSummary from "./VerifiedPlanSummary";

interface VerifiedPlanOverviewProps {
  route: RouteVisualization;
  plan: VerifiedPlan;
  planningHubs: ResupplyZone[];
  verifiedRecords: Record<string, VerifiedStopRecord>;
}

export default function VerifiedPlanOverview({
  route,
  plan,
  planningHubs,
  verifiedRecords,
}: VerifiedPlanOverviewProps) {
  const [showUnreviewed, setShowUnreviewed] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Your verified plan</h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={showUnreviewed}
            onChange={(event) => setShowUnreviewed(event.target.checked)}
            className="rounded border-line"
          />
          Show unreviewed
        </label>
      </div>

      <div className="mt-4 space-y-4">
        <VerifiedPlanMap
          route={route}
          verifiedStops={plan.stops}
          planningHubs={planningHubs}
          verifiedRecords={verifiedRecords}
          showUnreviewed={showUnreviewed}
        />
        <VerifiedPlanSummary plan={plan} />
      </div>
    </section>
  );
}
