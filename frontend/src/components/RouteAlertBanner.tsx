import type { ZoneGap } from "./routeInsights";
import { formatKm } from "./routeInsights";
import RoutePlanningInsight from "./route-workspace/RoutePlanningInsight";

interface RouteAlertBannerProps {
  longestGap: ZoneGap | null;
  maxGapThresholdKm: number;
  poorResupplyPct: number;
  zoneCount: number;
  totalZones: number;
}

export default function RouteAlertBanner({
  longestGap,
  poorResupplyPct,
  zoneCount,
  totalZones,
}: RouteAlertBannerProps) {
  if (!longestGap && poorResupplyPct === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {longestGap && (
        <RoutePlanningInsight
          icon="⚠"
          title="Longest unsupported section"
          distance={formatKm(longestGap.gapKm, 0)}
          elevationGain="+— m"
          detail={`${formatKm(longestGap.startKm, 0)} → ${formatKm(longestGap.endKm, 0)} · Plan food and water carefully`}
        />
      )}

      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span className="rounded-full bg-canvas px-2.5 py-1">
          Showing {zoneCount} of {totalZones} stops
        </span>
        {poorResupplyPct > 0 && (
          <span className="rounded-full bg-canvas px-2.5 py-1">
            {poorResupplyPct}% of route has limited resupply coverage
          </span>
        )}
      </div>
    </div>
  );
}
