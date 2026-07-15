import { useState } from "react";
import type { ResupplyZone, ZonePoiOption } from "../api";
import type { TimeMode } from "../planning/types";
import type { TimeWindowId } from "../planning/timeWindows";
import { buildStopRecommendations } from "../planning/stopRecommendations";
import RecommendedStopRow from "./RecommendedStopRow";

interface HubRecommendationSectionProps {
  zone: ResupplyZone;
  timeWindowId: TimeWindowId | null;
  timeMode: TimeMode;
  onSelectPoi?: (poi: ZonePoiOption) => void;
  showAlternativeSummary?: boolean;
}

export default function HubRecommendationSection({
  zone,
  timeWindowId,
  timeMode,
  onSelectPoi,
  showAlternativeSummary = true,
}: HubRecommendationSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const summary = buildStopRecommendations(zone);

  const recommendedKeys = new Set(
    [summary.primary, ...summary.alternatives]
      .filter(Boolean)
      .map((item) => `${item!.poi.osm_type}-${item!.poi.osm_id}`),
  );

  const remaining = summary.allRanked.filter(
    (item) => !recommendedKeys.has(`${item.poi.osm_type}-${item.poi.osm_id}`),
  );

  return (
    <div className="space-y-1">
      {showAlternativeSummary && summary.totalPois > 0 && (
        <div className="mb-3 space-y-0.5 text-xs text-muted">
          {summary.excellentAlternativeCount > 0 && (
            <p>{summary.excellentAlternativeCount} excellent alternative{summary.excellentAlternativeCount === 1 ? "" : "s"}</p>
          )}
          {summary.goodAlternativeCount > 0 && (
            <p>{summary.goodAlternativeCount} good alternative{summary.goodAlternativeCount === 1 ? "" : "s"}</p>
          )}
          {summary.additionalStopCount > 0 && (
            <p>{summary.additionalStopCount} additional stop{summary.additionalStopCount === 1 ? "" : "s"}</p>
          )}
        </div>
      )}

      {summary.primary && (
        <RecommendedStopRow
          ranked={summary.primary}
          roleLabel="Primary stop"
          timeWindowId={timeWindowId}
          timeMode={timeMode}
          onSelect={onSelectPoi}
        />
      )}

      {summary.alternatives.map((alternative, index) => (
        <RecommendedStopRow
          key={`${alternative.poi.osm_type}-${alternative.poi.osm_id}`}
          ranked={alternative}
          roleLabel={`Alternative ${index + 1}`}
          timeWindowId={timeWindowId}
          timeMode={timeMode}
          onSelect={onSelectPoi}
        />
      ))}

      {remaining.length > 0 && (
        <div className="border-t border-line/50 pt-2">
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="text-xs font-medium text-accent hover:text-accent/80"
          >
            {showAll ? "Hide additional stops" : `Show all ${summary.totalPois} stops`}
          </button>

          {showAll && (
            <div className="mt-2 space-y-0 divide-y divide-line/40">
              {remaining.map((ranked) => (
                <RecommendedStopRow
                  key={`${ranked.poi.osm_type}-${ranked.poi.osm_id}`}
                  ranked={ranked}
                  roleLabel={ranked.categoryLabel}
                  timeWindowId={timeWindowId}
                  timeMode={timeMode}
                  compact
                  onSelect={onSelectPoi}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
