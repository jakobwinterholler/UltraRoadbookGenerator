import type { UltraStopScoreResult } from "../planning/stopPresentation";
import { ultraStopTierClass } from "../planning/stopPresentation";

interface UltraStopScoreBadgeProps {
  score: UltraStopScoreResult;
  showBreakdown?: boolean;
}

export default function UltraStopScoreBadge({ score, showBreakdown = false }: UltraStopScoreBadgeProps) {
  return (
    <div className={`rounded-xl px-3 py-2 ring-1 ${ultraStopTierClass(score.tier)}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">Ultra Stop Score</p>
          <p className="text-lg font-semibold tabular-nums">{score.score}</p>
        </div>
        <p className="text-sm font-medium">{score.label}</p>
      </div>
      {showBreakdown && (
        <ul className="mt-2 space-y-0.5 border-t border-current/10 pt-2 text-xs">
          {score.breakdown.map((item) => (
            <li key={item.key} className="flex justify-between gap-2">
              <span>{item.label}</span>
              <span className="tabular-nums font-semibold">{item.points > 0 ? `+${item.points}` : item.points}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
