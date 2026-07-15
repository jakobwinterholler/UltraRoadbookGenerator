import { useMemo, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { fetchOriginalGpx } from "@shared/api/sync";
import {
  exportGpxForGps,
  GpxExportQualityError,
  GpxTrackModifiedError,
  ROUTE_INTEGRITY_FAILED_MESSAGE,
  type GpsGpxDeviceProfile,
  type GpsGpxExportReport,
} from "@shared/race/gpsGpxExport";
import type { CompanionBundle } from "@shared/types/sync";
import { loadOriginalGpx, saveOriginalGpx } from "../db";
import { shareGpxFile } from "../lib/shareGpxFile";

const DEVICE_OPTIONS: Array<{ id: GpsGpxDeviceProfile; label: string; hint: string }> = [
  { id: "original", label: "GPX (Original)", hint: "Full waypoint names" },
  { id: "coros", label: "GPX for Coros", hint: "Native icons and short names" },
  { id: "garmin", label: "GPX for Garmin", hint: "Balanced names" },
  { id: "wahoo", label: "GPX for Wahoo", hint: "Balanced names" },
];

function countVerifiedStops(bundle: CompanionBundle): number {
  return bundle.stops.filter((stop) => stop.verificationStatus === "verified").length;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function ExportReportPanel({ report }: { report: GpsGpxExportReport }) {
  return (
    <div className="mt-4 space-y-1 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
      <p className="font-semibold text-white">
        Route integrity: {report.routeIntegrityPassed ? "✓ Passed" : "✗ Failed"}
      </p>
      <p>Trackpoints: {formatNumber(report.trackPointCount)}</p>
      <p>Distance: {report.distanceKm.toFixed(2)} km</p>
      <p>Ascent: {formatNumber(report.elevationGainM)} m</p>
      {report.elevationDescentM > 0 ? <p>Descent: {formatNumber(report.elevationDescentM)} m</p> : null}
      <p>Verified POIs: {report.verifiedPoiCount}</p>
      <p>Exported POIs: {report.exportedPoiCount}</p>
      {report.deviceProfile === "coros" && report.corosIconsAssigned != null ? (
        <p>
          Coros Icons: {report.corosIconsAssigned}/{report.corosIconsTotal ?? report.exportedPoiCount}{" "}
          assigned
        </p>
      ) : null}
      <p>Integrity: {report.integrityPercent}%</p>
    </div>
  );
}

interface GpsGpxExportPanelProps {
  bundle: CompanionBundle;
  onSuccess?: () => void;
  showCancel?: boolean;
  onCancel?: () => void;
}

export default function GpsGpxExportPanel({
  bundle,
  onSuccess,
  showCancel = false,
  onCancel,
}: GpsGpxExportPanelProps) {
  const { accessToken, user } = useAuth();
  const [device, setDevice] = useState<GpsGpxDeviceProfile>("coros");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [includeHighConfidence, setIncludeHighConfidence] = useState(false);
  const [includeAlternatives, setIncludeAlternatives] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GpsGpxExportReport | null>(null);

  const verifiedCount = useMemo(() => countVerifiedStops(bundle), [bundle]);

  async function resolveOriginalGpx(): Promise<ArrayBuffer> {
    const cached = await loadOriginalGpx(bundle.race.id);
    if (cached) {
      return cached;
    }
    if (!accessToken || !user?.id) {
      throw new Error("Connect to the internet once to download the original route GPX.");
    }
    const gpx = await fetchOriginalGpx(accessToken, bundle.race.id, user.id);
    await saveOriginalGpx(bundle.race.id, gpx);
    return gpx;
  }

  async function handleExport() {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const originalGpx = await resolveOriginalGpx();
      const { bytes, report: exportReport } = exportGpxForGps(originalGpx, bundle, {
        deviceProfile: device,
        verifiedOnly,
        includeHighConfidence,
        includeAlternatives,
      });
      const slug = bundle.race.name.trim().replace(/\s+/g, "-") || "race";
      const filename = `${slug}-gps-${device}.gpx`;
      await shareGpxFile(bytes, filename);
      setReport(exportReport);
      if (exportReport.exportedPoiCount === 0) {
        setError("Exported original route only — no verified stops matched your options.");
      } else {
        onSuccess?.();
      }
    } catch (err) {
      if (err instanceof GpxTrackModifiedError) {
        setError(ROUTE_INTEGRITY_FAILED_MESSAGE);
      } else if (err instanceof GpxExportQualityError) {
        setError(err.message);
      } else if (err instanceof Error && err.name === "AbortError") {
        onCancel?.();
      } else {
        setError(err instanceof Error ? err.message : "GPS GPX export failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white">Race GPX for GPS</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        Exports your original GPX unchanged and adds navigation waypoints. Share to Coros, Files,
        or AirDrop.
        {verifiedCount > 0
          ? ` ${verifiedCount} verified stop${verifiedCount === 1 ? "" : "s"} available.`
          : " No verified stops yet — you'll get the original route only."}
      </p>

      {!report ? (
        <>
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Format</p>
            {DEVICE_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                  device === option.id ? "border-sky-400/40 bg-sky-500/10" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <input
                  type="radio"
                  name="gps-device-mobile"
                  checked={device === option.id}
                  onChange={() => setDevice(option.id)}
                  className="mt-1 accent-sky-400"
                />
                <span>
                  <span className="block text-sm font-medium text-white">{option.label}</span>
                  <span className="block text-xs text-white/45">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Waypoints</p>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-white/85">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
                className="accent-sky-400"
              />
              Verified stops only
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-white/85">
              <input
                type="checkbox"
                checked={includeHighConfidence}
                onChange={(event) => setIncludeHighConfidence(event.target.checked)}
                disabled={device === "coros"}
                className="accent-sky-400 disabled:opacity-50"
              />
              Include high-confidence stops
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-white/85">
              <input
                type="checkbox"
                checked={includeAlternatives}
                onChange={(event) => setIncludeAlternatives(event.target.checked)}
                className="accent-sky-400"
              />
              Include alternatives
            </label>
          </div>
        </>
      ) : (
        <ExportReportPanel report={report} />
      )}

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-5 flex gap-2">
        {showCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-[48px] flex-1 rounded-xl border border-white/12 text-sm font-medium text-white/80"
          >
            {report ? "Done" : "Cancel"}
          </button>
        ) : null}
        {!report ? (
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={loading}
            className={`min-h-[48px] rounded-xl bg-sky-500 text-sm font-semibold text-white disabled:opacity-60 ${
              showCancel ? "flex-1" : "w-full"
            }`}
          >
            {loading ? "Validating…" : "Share GPX"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
