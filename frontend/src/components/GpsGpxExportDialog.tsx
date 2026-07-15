import { useState } from "react";
import type { VerifiedStopRecord } from "../planning/stopVerification/types";
import { downloadExport } from "../api";
import { raceGpsExportEndpoint } from "../races/api";

export type GpsGpxDeviceProfile = "original" | "coros" | "garmin" | "wahoo";

export interface GpsGpxExportOptions {
  device: GpsGpxDeviceProfile;
  verifiedOnly: boolean;
  includeHighConfidence: boolean;
  includeAlternatives: boolean;
}

interface GpsGpxExportDialogProps {
  raceId: string;
  raceName: string;
  open: boolean;
  verifiedStops: Record<string, VerifiedStopRecord>;
  onClose: () => void;
  onExported?: () => void;
}

const DEVICE_OPTIONS: Array<{ id: GpsGpxDeviceProfile; label: string; hint: string }> = [
  { id: "original", label: "GPX (Original)", hint: "Full waypoint names and metadata" },
  { id: "coros", label: "GPX for Coros", hint: "Short emoji names for Dura screens" },
  { id: "garmin", label: "GPX for Garmin", hint: "Balanced names for Edge devices" },
  { id: "wahoo", label: "GPX for Wahoo", hint: "Balanced names for ELEMNT devices" },
];

function countVerifiedStops(verifiedStops: Record<string, VerifiedStopRecord>): number {
  return Object.values(verifiedStops).filter((record) => record.status === "verified").length;
}

export default function GpsGpxExportDialog({
  raceId,
  raceName,
  open,
  verifiedStops,
  onClose,
  onExported,
}: GpsGpxExportDialogProps) {
  const [device, setDevice] = useState<GpsGpxDeviceProfile>("coros");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [includeHighConfidence, setIncludeHighConfidence] = useState(false);
  const [includeAlternatives, setIncludeAlternatives] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifiedCount = countVerifiedStops(verifiedStops);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = raceGpsExportEndpoint(raceId, {
        device,
        verifiedOnly,
        includeHighConfidence,
        includeAlternatives,
      });
      const slug = raceName.trim().replace(/\s+/g, "-") || "race";
      await downloadExport(endpoint, `${slug}-gps-${device}.gpx`);
      onExported?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GPS GPX export failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close export dialog"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-card">
        <h3 className="text-xl font-semibold text-ink">Race GPX for GPS</h3>
        <p className="mt-2 text-sm text-muted">
          Exports your original GPX track unchanged and adds navigation waypoints only.
          {verifiedCount > 0
            ? ` ${verifiedCount} verified stop${verifiedCount === 1 ? "" : "s"} will be included by default.`
            : " No verified stops yet — export will contain the original route only."}
        </p>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Format</p>
          {DEVICE_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                device === option.id ? "border-accent bg-accent/5" : "border-line bg-canvas"
              }`}
            >
              <input
                type="radio"
                name="gps-device"
                checked={device === option.id}
                onChange={() => setDevice(option.id)}
                className="mt-1 accent-accent"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{option.label}</span>
                <span className="block text-xs text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Waypoints</p>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
              className="accent-accent"
            />
            Verified stops only (default)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeHighConfidence}
              onChange={(event) => setIncludeHighConfidence(event.target.checked)}
              className="accent-accent"
            />
            Include high-confidence stops
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeAlternatives}
              onChange={(event) => setIncludeAlternatives(event.target.checked)}
              className="accent-accent"
            />
            Include alternatives
          </label>
        </div>

        <p className="mt-4 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
          Validation runs before download: track point count, distance, elevation gain, and geometry
          checksum must match the imported GPX. Export is cancelled if the route changed.
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={loading}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Validating…" : "Export GPX"}
          </button>
        </div>
      </div>
    </div>
  );
}
