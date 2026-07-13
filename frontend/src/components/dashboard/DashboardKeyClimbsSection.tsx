import type { AnalyzedClimb } from "../../planning/climbAnalysis";
import DashboardKeyClimbCard from "./DashboardKeyClimbCard";

interface DashboardKeyClimbsSectionProps {
  climbs: AnalyzedClimb[];
  totalClimbCount: number;
  onSelectClimb: (climbId: string) => void;
  onViewAllClimbs: () => void;
}

export default function DashboardKeyClimbsSection({
  climbs,
  totalClimbCount,
  onSelectClimb,
  onViewAllClimbs,
}: DashboardKeyClimbsSectionProps) {
  if (climbs.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Key climbs</h2>
          <p className="mt-1 text-sm text-muted">
            Which climbs deserve your attention — ranked by difficulty.
          </p>
        </div>
        {totalClimbCount > climbs.length && (
          <button
            type="button"
            onClick={onViewAllClimbs}
            className="text-sm text-accent transition hover:text-accent/80"
          >
            View all {totalClimbCount} climbs →
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:gap-5">
        {climbs.map((climb, index) => (
          <DashboardKeyClimbCard
            key={climb.id}
            climb={climb}
            rank={index + 1}
            onSelect={onSelectClimb}
          />
        ))}
      </div>
    </section>
  );
}
