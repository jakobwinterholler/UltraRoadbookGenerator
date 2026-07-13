import type { RoadbookResult } from "../api";
import { formatElapsed } from "../progress";

interface AnalysisCompleteViewProps {
  result: RoadbookResult;
  analysisSeconds: number;
}

export default function AnalysisCompleteView({ result, analysisSeconds }: AnalysisCompleteViewProps) {
  const { summary } = result;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-lg text-center">
        <p className="text-success text-lg">✓</p>
        <h1 className="mt-3 text-display font-semibold tracking-tight text-ink">Analysis complete</h1>
        <div className="mt-8 grid grid-cols-2 gap-4 text-left">
          <div>
            <p className="text-caption text-muted">Distance</p>
            <p className="mt-1 text-stat tabular-nums text-ink">{summary.distance_km.toFixed(0)} km</p>
          </div>
          <div>
            <p className="text-caption text-muted">Elevation</p>
            <p className="mt-1 text-stat tabular-nums text-ink">+{summary.elevation_gain_m.toLocaleString()} m</p>
          </div>
          <div>
            <p className="text-caption text-muted">Climbs</p>
            <p className="mt-1 text-stat tabular-nums text-ink">{summary.climb_count}</p>
          </div>
          <div>
            <p className="text-caption text-muted">Resupply zones</p>
            <p className="mt-1 text-stat tabular-nums text-ink">{result.resupply_zones.length}</p>
          </div>
        </div>
        <p className="mt-8 text-caption text-muted">
          Analysis time {formatElapsed(analysisSeconds)}
        </p>
      </div>
    </div>
  );
}
