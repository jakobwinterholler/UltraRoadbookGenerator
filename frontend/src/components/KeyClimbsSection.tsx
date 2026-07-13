import type { AnalyzedClimb } from "../planning/climbAnalysis";
import KeyClimbCard from "./KeyClimbCard";

interface KeyClimbsSectionProps {
  climbs: AnalyzedClimb[];
  title?: string;
  description?: string;
  selectedClimbId?: string | null;
  onSelectClimb?: (climbId: string) => void;
  compact?: boolean;
}

export default function KeyClimbsSection({
  climbs,
  title = "Most Important Climbs",
  description = "Ranked by absolute difficulty — select a climb to see the full profile and resupply context.",
  selectedClimbId = null,
  onSelectClimb,
  compact = false,
}: KeyClimbsSectionProps) {
  if (climbs.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>

      <div
        className={`grid gap-4 ${
          compact
            ? "md:grid-cols-2 xl:grid-cols-3"
            : "md:grid-cols-2 xl:grid-cols-3 [&>*:nth-child(-n+3)]:xl:min-h-[220px]"
        }`}
      >
        {climbs.map((climb, index) => (
          <KeyClimbCard
            key={climb.id}
            climb={climb}
            rank={index + 1}
            selected={selectedClimbId === climb.id}
            onSelect={onSelectClimb}
          />
        ))}
      </div>
    </section>
  );
}
