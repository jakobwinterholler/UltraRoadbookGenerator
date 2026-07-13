import type { ClimbCandidateRow } from "../api";

interface ClimbCandidateTableProps {
  candidates: ClimbCandidateRow[];
  selectedCandidateId: string | null;
  onSelectCandidate?: (candidateId: string) => void;
}

export default function ClimbCandidateTable({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
}: ClimbCandidateTableProps) {
  const rejected = candidates.filter((candidate) => candidate.status === "rejected");

  if (rejected.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-card/60 p-6 text-sm text-muted">
        No rejected climb candidates recorded. Re-run analysis to refresh debug data.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">Rejected climb candidates</h3>
        <p className="mt-1 text-xs text-muted">
          Debug view — shows why uphill segments were not accepted as climbs.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Start</th>
              <th className="px-4 py-3 font-semibold">End</th>
              <th className="px-4 py-3 font-semibold">Length</th>
              <th className="px-4 py-3 font-semibold">Gain</th>
              <th className="px-4 py-3 font-semibold">Net gain</th>
              <th className="px-4 py-3 font-semibold">Avg %</th>
              <th className="px-4 py-3 font-semibold">Max %</th>
              <th className="px-4 py-3 font-semibold">Rejected because</th>
            </tr>
          </thead>
          <tbody>
            {rejected.map((candidate, index) => (
              <tr
                key={candidate.candidate_id}
                onClick={() => onSelectCandidate?.(candidate.candidate_id)}
                className={`border-b border-line/70 transition hover:bg-canvas/40 ${
                  onSelectCandidate ? "cursor-pointer" : ""
                } ${selectedCandidateId === candidate.candidate_id ? "bg-accent/[0.05] ring-1 ring-inset ring-accent/20" : index % 2 === 0 ? "bg-white" : "bg-canvas/20"}`}
              >
                <td className="px-4 py-3 font-medium text-ink">{candidate.candidate_id}</td>
                <td className="px-4 py-3 tabular-nums">{candidate.start_km.toFixed(1)}</td>
                <td className="px-4 py-3 tabular-nums">{candidate.end_km.toFixed(1)}</td>
                <td className="px-4 py-3 tabular-nums">{candidate.length_km.toFixed(2)} km</td>
                <td className="px-4 py-3 tabular-nums">{Math.round(candidate.elevation_gain_m)} m</td>
                <td className="px-4 py-3 tabular-nums">{Math.round(candidate.net_elevation_gain_m)} m</td>
                <td className="px-4 py-3 tabular-nums">{candidate.avg_gradient_pct.toFixed(1)}%</td>
                <td className="px-4 py-3 tabular-nums">
                  {candidate.max_gradient_pct !== null ? `${candidate.max_gradient_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-muted">{candidate.rejection_label ?? "Other"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
