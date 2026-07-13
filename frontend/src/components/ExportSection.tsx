import { useState } from "react";
import type { RoadbookResult } from "../api";
import { downloadExport } from "../api";
import type { VerifiedStopRecord } from "../planning/stopVerification/types";
import { raceExportEndpoint } from "../races/api";

interface ExportSectionProps {
  raceId: string;
  result: RoadbookResult;
  verifiedStops: Record<string, VerifiedStopRecord>;
  onExported?: () => void;
}

export default function ExportSection({
  raceId,
  onExported,
}: ExportSectionProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleExport(endpoint: string, filename: string, label: string) {
    setError(null);
    setLoading(label);
    try {
      await downloadExport(endpoint, filename);
      onExported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Export</h3>
      <p className="mt-1 text-sm text-muted">
        Download your roadbook or validation files. Races sync automatically to the Companion app when
        you are signed in.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleExport(raceExportEndpoint(raceId, "excel"), "Roadbook.xlsx", "excel")}
          disabled={loading !== null}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
        >
          {loading === "excel" ? "Exporting…" : "Export Excel"}
        </button>

        <button
          type="button"
          onClick={() =>
            handleExport(raceExportEndpoint(raceId, "validation-gpx"), "surface_validation.gpx", "gpx")
          }
          disabled={loading !== null}
          className="rounded-xl border border-line bg-canvas px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/30 hover:bg-white disabled:opacity-60"
        >
          {loading === "gpx" ? "Exporting…" : "Validation GPX"}
        </button>

        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-line px-5 py-2.5 text-sm font-medium text-muted"
          title="Coming soon"
        >
          Export PDF — Coming Soon
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </section>
  );
}
