import {
  computeStopConfidence,
  stopConfidenceBadgeClass,
  type StopConfidenceInput,
  type StopConfidenceLevel,
} from "@shared/race/stopConfidence";

interface StopConfidenceBadgeProps {
  input: StopConfidenceInput;
  dark?: boolean;
  className?: string;
}

export function StopConfidenceBadge({ input, dark = false, className = "" }: StopConfidenceBadgeProps) {
  const result = computeStopConfidence(input);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${stopConfidenceBadgeClass(result.level, dark)} ${className}`}
    >
      {result.label}
    </span>
  );
}

interface StopConfidenceListProps {
  stops: Array<StopConfidenceInput & { name: string; zoneId: number }>;
  className?: string;
}

function groupByLevel(
  stops: StopConfidenceListProps["stops"],
): Record<StopConfidenceLevel, StopConfidenceListProps["stops"]> {
  const groups: Record<StopConfidenceLevel, StopConfidenceListProps["stops"]> = {
    low: [],
    needs_review: [],
    high: [],
  };
  for (const stop of stops) {
    const { level } = computeStopConfidence(stop);
    groups[level].push(stop);
  }
  return groups;
}

export function StopConfidenceOverview({ stops, className = "" }: StopConfidenceListProps) {
  const groups = groupByLevel(stops);
  const sections: Array<{ level: StopConfidenceLevel; title: string; items: StopConfidenceListProps["stops"] }> = [
    { level: "low", title: "Low confidence", items: groups.low },
    { level: "needs_review", title: "Needs review", items: groups.needs_review },
    { level: "high", title: "High confidence", items: groups.high },
  ];

  const hasAny = sections.some((section) => section.items.length > 0);
  if (!hasAny) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <div key={section.level}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {section.title} ({section.items.length})
            </p>
            <ul className="mt-2 space-y-1">
              {section.items.slice(0, 6).map((stop) => (
                <li
                  key={stop.zoneId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-canvas/40 px-3 py-2 text-sm"
                >
                  <span className="truncate text-ink">{stop.name}</span>
                  <StopConfidenceBadge input={stop} />
                </li>
              ))}
              {section.items.length > 6 ? (
                <li className="px-3 text-xs text-muted">+{section.items.length - 6} more</li>
              ) : null}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
