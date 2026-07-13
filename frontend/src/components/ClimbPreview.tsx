import { useMemo } from "react";
import type { ClimbRow } from "../api";
import KeyClimbsSection from "./KeyClimbsSection";
import { analyzeClimbs, keyClimbCount, selectKeyClimbs } from "../planning/climbAnalysis";

interface ClimbPreviewProps {
  climbs: ClimbRow[];
  onViewAll: () => void;
}

export default function ClimbPreview({ climbs, onViewAll }: ClimbPreviewProps) {
  const keyClimbs = useMemo(() => selectKeyClimbs(analyzeClimbs(climbs)), [climbs]);
  const previewCount = keyClimbCount(climbs.length);
  const preview = keyClimbs.slice(0, Math.min(3, previewCount));

  if (climbs.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">Key climbs</h3>
          <p className="mt-1 text-sm text-muted">
            Top {preview.length} of {climbs.length} climbs by difficulty
          </p>
        </div>
        {climbs.length > preview.length && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-semibold text-accent transition hover:text-accent/80"
          >
            View all climbs
          </button>
        )}
      </div>
      <KeyClimbsSection climbs={preview} compact />
    </section>
  );
}
