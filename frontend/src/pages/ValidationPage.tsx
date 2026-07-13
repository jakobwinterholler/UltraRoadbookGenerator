import type { RoadbookResult } from "../api";
import ClimbCandidateTable from "../components/ClimbCandidateTable";
import PerformanceReport from "../components/PerformanceReport";
import SurfaceDiagnosticsPanel from "../components/SurfaceDiagnosticsPanel";

interface ValidationPageProps {
  result: RoadbookResult;
}

export default function ValidationPage({ result }: ValidationPageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-10">
      <div>
        <h1 className="text-display font-semibold tracking-tight text-ink">Validation</h1>
        <p className="mt-2 text-body text-muted">
          Debug and optimization tools — understand why the algorithm made its decisions.
        </p>
      </div>

      {result.surface_diagnostics && (
        <SurfaceDiagnosticsPanel diagnostics={result.surface_diagnostics} />
      )}

      {result.performance_report && result.performance_report.length > 0 && (
        <PerformanceReport
          report={result.performance_report}
          summary={result.performance_summary ?? null}
        />
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-h2 font-semibold text-ink">Rejected climb candidates</h2>
          <p className="mt-1 text-body text-muted">
            Uphill segments that were visible but did not meet detection thresholds.
          </p>
        </div>
        <ClimbCandidateTable candidates={result.climb_candidates} selectedCandidateId={null} />
      </section>
    </div>
  );
}
