import { useState } from "react";
import type { ResupplyZone, ZonePoiOption } from "../api";
import type { TimeMode } from "../planning/types";
import type { TimeWindowId } from "../planning/timeWindows";
import { buildHubRecommendations } from "../planning/hubRecommendations";
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
  const summary = buildHubRecommendations(zone);

  const recommendedKeys = new Set(
    [summary.best, ...summary.backups]
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

      {summary.best && (
        <RecommendedStopRow
          ranked={summary.best}
          roleLabel="Best option"
          timeWindowId={timeWindowId}
          timeMode={timeMode}
          onSelect={onSelectPoi}
        />
      )}

      {summary.backups.map((backup, index) => (
        <RecommendedStopRow
          key={`${backup.poi.osm_type}-${backup.poi.osm_id}`}
          ranked={backup}
          roleLabel={`Backup ${index + 1}`}
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
