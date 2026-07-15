import { useState } from "react";
import { fetchWithAuth } from "@shared/api/client";
import { useAuth } from "@shared/auth/AuthProvider";

interface CompareSide {
  revision: number | null;
  schemaVersion: number | null;
  bundleChecksum: string | null;
  generatedAt: string | null;
  stopCount: number;
  climbCount: number;
  climbIds: string[];
  stopNames: string[];
}

interface CompareResult {
  raceId: string;
  identical: boolean;
  differences: string[];
  desktop: CompareSide;
  cloud: CompareSide;
}

interface DesktopCompanionCompareProps {
  raceId: string | null;
  raceName?: string;
}

export default function DesktopCompanionCompare({
  raceId,
  raceName,
}: DesktopCompanionCompareProps) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  async function handleCompare() {
    if (!raceId || !accessToken) {
      setError("Open a race and sign in to compare.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`/api/sync/races/${raceId}/compare`, accessToken);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: "Compare failed." }));
        throw new Error(typeof payload.detail === "string" ? payload.detail : "Compare failed.");
      }
      setResult((await response.json()) as CompareResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  if (!raceId) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Compare Desktop vs Companion</h3>
        <p className="text-sm text-muted">Open a race with analysis to compare bundle data.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Compare Desktop vs Companion</h3>
        <p className="mt-1 text-sm text-muted">
          Diff climb count, resupply stops, checksum, and POI names for {raceName ?? "this race"}.
        </p>
      </div>
      <button
        type="button"
        disabled={loading || !accessToken}
        onClick={() => void handleCompare()}
        className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
      >
        {loading ? "Comparing…" : "Compare Desktop vs Companion"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? (
        <div className="space-y-3 rounded-xl border border-line bg-canvas p-4 text-sm">
          <p className={result.identical ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
            {result.identical ? "Desktop and cloud bundles are identical." : "Differences found:"}
          </p>
          {result.differences.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {result.differences.map((difference) => (
                <li key={difference}>{difference}</li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {(["desktop", "cloud"] as const).map((side) => {
              const data = result[side];
              return (
                <div key={side} className="rounded-lg border border-line bg-card p-3">
                  <p className="font-semibold capitalize text-ink">{side}</p>
                  <dl className="mt-2 space-y-1 text-xs text-muted">
                    <div className="flex justify-between gap-2">
                      <dt>Revision</dt>
                      <dd className="tabular-nums text-ink">{data.revision ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Schema</dt>
                      <dd className="tabular-nums text-ink">{data.schemaVersion ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Stops</dt>
                      <dd className="tabular-nums text-ink">{data.stopCount}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Climbs</dt>
                      <dd className="tabular-nums text-ink">{data.climbCount}</dd>
                    </div>
                    <div>
                      <dt>Climb IDs</dt>
                      <dd className="mt-0.5 break-all text-ink">{data.climbIds.join(", ") || "—"}</dd>
                    </div>
                    <div>
                      <dt>Checksum</dt>
                      <dd className="mt-0.5 break-all font-mono text-[10px] text-ink">
                        {data.bundleChecksum?.slice(0, 16) ?? "—"}…
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
