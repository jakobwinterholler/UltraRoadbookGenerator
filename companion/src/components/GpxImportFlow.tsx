import {
  fetchImportDuplicates,
  importApiAvailable,
  importGpxStream,
  type ConflictAction,
  type ImportDuplicateMatch,
  type ImportGpxEvent,
} from "@shared/api/importGpx";
import { useAuth } from "@shared/auth/AuthProvider";
import type { CompanionBundle } from "@shared/types/sync";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveCompanionBundle, saveOriginalGpx, saveRaceList, loadRaceList } from "../db";
import { fingerprintGpxFile } from "../lib/gpxFingerprint";
import DuplicateRaceDialog from "./DuplicateRaceDialog";

const STAGE_ORDER = [
  "loading",
  "analyzing",
  "climbs",
  "resupply",
  "bundle",
  "ready",
] as const;

interface ImportStageState {
  id: string;
  label: string;
  status: "pending" | "active" | "complete";
  percent?: number;
}

const DEFAULT_STAGES: ImportStageState[] = [
  { id: "loading", label: "Loading…", status: "pending" },
  { id: "analyzing", label: "Analyzing route…", status: "pending" },
  { id: "climbs", label: "Detecting climbs…", status: "pending" },
  { id: "resupply", label: "Finding resupply…", status: "pending" },
  { id: "bundle", label: "Creating companion bundle…", status: "pending" },
  { id: "ready", label: "Ready to ride.", status: "pending" },
];

interface GpxImportFlowProps {
  file: File | null;
  onClose: () => void;
  onComplete: (bundle: CompanionBundle) => void;
  online: boolean;
}

export default function GpxImportFlow({ file, onClose, onComplete, online }: GpxImportFlowProps) {
  const { accessToken } = useAuth();
  const [stages, setStages] = useState<ImportStageState[]>(DEFAULT_STAGES);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [duplicates, setDuplicates] = useState<ImportDuplicateMatch[] | null>(null);
  const [pendingFile] = useState<File | null>(file);
  const startedRef = useRef(false);

  const applyEvent = useCallback((event: ImportGpxEvent) => {
    if (event.type === "import_stage") {
      setStages((current) => {
        const next = current.map((stage) => ({ ...stage }));
        const index = next.findIndex((stage) => stage.id === event.stage_id);
        if (index >= 0) {
          next[index] = {
            ...next[index],
            label: event.label,
            status: event.status === "complete" ? "complete" : "active",
            percent: event.percent,
          };
          if (event.status === "active") {
            for (let i = 0; i < index; i += 1) {
              if (next[i].status !== "complete") {
                next[i].status = "complete";
              }
            }
          }
        }
        return next;
      });
      return;
    }
    if (event.type === "progress" && event.stage_id) {
      setStages((current) =>
        current.map((stage) =>
          stage.id === event.stage_id
            ? { ...stage, status: "active", percent: event.percent, label: event.label ?? stage.label }
            : stage,
        ),
      );
    }
  }, []);

  const persistImport = useCallback(
    async (result: { raceId: string; bundle: CompanionBundle; companionRevision: number | null }, sourceFile: File) => {
      const gpxBytes = await sourceFile.arrayBuffer();
      await saveCompanionBundle(result.bundle);
      await saveOriginalGpx(result.raceId, gpxBytes);

      const existing = await loadRaceList();
      const revision =
        result.companionRevision ??
        result.bundle.revision ??
        result.bundle.bundle_version ??
        1;
      const others = existing.filter((race) => race.id !== result.raceId);
      await saveRaceList([
        {
          id: result.raceId,
          name: result.bundle.race.name,
          distance_km: result.bundle.race.distanceKm,
          elevation_gain_m: result.bundle.race.elevationGainM,
          companion_revision: revision,
          version: revision,
          bundle_version: revision,
          bundle_checksum: result.bundle.bundleChecksum ?? null,
          bundle_schema_version: result.bundle.schemaVersion,
          updated_at: result.bundle.syncedAt ?? new Date().toISOString(),
          analyzed_at: result.bundle.race.analyzedAt ?? null,
          has_bundle: true,
          readiness_score: result.bundle.dashboardStats?.readinessScore ?? null,
          downloadedRevision: revision,
          downloadedChecksum: result.bundle.bundleChecksum ?? null,
          offlineReady: true,
          source: "local-import",
          lastOpenedAt: new Date().toISOString(),
        },
        ...others,
      ]);
    },
    [],
  );

  const runImport = useCallback(
    async (sourceFile: File, conflictAction: ConflictAction, replaceRaceId?: string) => {
      if (!accessToken) {
        setError("Sign in to import and analyze a GPX route.");
        return;
      }
      if (!online) {
        setError("An internet connection is required for full route analysis.");
        return;
      }
      if (!importApiAvailable()) {
        setError(
          "Route analysis server is not configured for this build. Contact support or use desktop Ultra Roadbook.",
        );
        return;
      }

      setRunning(true);
      setError(null);
      setStages(DEFAULT_STAGES.map((stage, index) => ({
        ...stage,
        status: index === 0 ? "active" : "pending",
      })));

      try {
        const result = await importGpxStream(
          accessToken,
          {
            file: sourceFile,
            name: sourceFile.name.replace(/\.gpx$/i, "").replace(/[_-]+/g, " "),
            conflictAction,
            replaceRaceId,
          },
          applyEvent,
        );
        await persistImport(result, sourceFile);
        onComplete(result.bundle);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
        setRunning(false);
      }
    },
    [accessToken, applyEvent, online, onComplete, persistImport],
  );

  useEffect(() => {
    if (!pendingFile || startedRef.current) {
      return;
    }
    startedRef.current = true;

    void (async () => {
      if (!accessToken || !online || !importApiAvailable()) {
        if (!online) {
          setError("An internet connection is required for full route analysis.");
        } else if (!importApiAvailable()) {
          setError("Route analysis server is not configured for this build.");
        } else {
          setError("Sign in to import and analyze a GPX route.");
        }
        return;
      }
      try {
        const fingerprint = await fingerprintGpxFile(pendingFile);
        const matches = await fetchImportDuplicates(accessToken, fingerprint);
        if (matches.length > 0) {
          setDuplicates(matches);
          return;
        }
        await runImport(pendingFile, "create");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start import.");
      }
    })();
  }, [accessToken, online, pendingFile, runImport]);

  const overallPercent = (() => {
    const weights = STAGE_ORDER.map(() => 100 / STAGE_ORDER.length);
    let total = 0;
    stages.forEach((stage, index) => {
      if (stage.status === "complete") {
        total += weights[index];
      } else if (stage.status === "active") {
        total += (weights[index] * (stage.percent ?? 50)) / 100;
      }
    });
    return Math.min(100, Math.round(total));
  })();

  if (!pendingFile) {
    return null;
  }

  return (
    <>
      {duplicates ? (
        <DuplicateRaceDialog
          matches={duplicates}
          fileName={pendingFile.name}
          onReplace={(raceId) => {
            setDuplicates(null);
            void runImport(pendingFile, "replace", raceId);
          }}
          onDuplicate={() => {
            setDuplicates(null);
            void runImport(pendingFile, "create");
          }}
          onCancel={() => {
            setDuplicates(null);
            onClose();
          }}
        />
      ) : null}

      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-4 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/80">
                Importing route
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-white">{pendingFile.name}</h2>
            </div>
            {!running ? (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-white/45 hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-white/45">
              <span>{running ? "Working…" : error ? "Stopped" : "Ready"}</span>
              <span>{overallPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>

          <ul className="mt-5 space-y-2">
            {stages.map((stage) => (
              <li key={stage.id} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    stage.status === "complete"
                      ? "bg-emerald-500 text-black"
                      : stage.status === "active"
                        ? "bg-sky-400/20 text-sky-200"
                        : "bg-white/8 text-white/30"
                  }`}
                >
                  {stage.status === "complete" ? "✓" : stage.status === "active" ? "…" : ""}
                </span>
                <span
                  className={
                    stage.status === "active"
                      ? "font-medium text-white"
                      : stage.status === "complete"
                        ? "text-white/55"
                        : "text-white/35"
                  }
                >
                  {stage.label}
                </span>
              </li>
            ))}
          </ul>

          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        </div>
      </div>
    </>
  );
}
