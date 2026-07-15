import type { CompanionBundle } from "../types/sync";
import { fetchWithAuth, getApiBaseUrl, parseApiError } from "./client";
import {
  formatBundlePrepareFailure,
  prepareCompanionBundle,
} from "../sync/bundleMigration";

export interface ImportStageEvent {
  type: "import_stage";
  stage_id: string;
  label: string;
  status: "active" | "complete";
  percent?: number;
}

export interface ImportDuplicateMatch {
  id: string;
  name: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  updated_at: string | null;
  source?: "local" | "cloud";
}

export type ImportGpxEvent =
  | ImportStageEvent
  | { type: "progress"; percent: number; label?: string; stage_id?: string }
  | { type: "race_created"; race_id: string; fingerprint: string; name: string }
  | { type: "complete"; race_id: string; bundle: CompanionBundle; fingerprint: string }
  | { type: "synced"; sync: { race_id: string; companion_revision: number; synced_at: string } }
  | { type: "sync_warning"; detail: string }
  | { type: "error"; detail: string }
  | { type: "step"; step_id: string; status: string; label: string };

export type ConflictAction = "create" | "replace";

export interface ImportGpxOptions {
  file: File;
  name?: string;
  conflictAction?: ConflictAction;
  replaceRaceId?: string;
}

export interface ImportGpxResult {
  raceId: string;
  bundle: CompanionBundle;
  fingerprint: string;
  companionRevision: number | null;
}

export function importApiAvailable(): boolean {
  return Boolean(getApiBaseUrl());
}

export async function computeGpxFingerprint(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function fetchImportDuplicates(
  accessToken: string,
  fingerprint: string,
): Promise<ImportDuplicateMatch[]> {
  if (!getApiBaseUrl()) {
    return [];
  }
  const response = await fetchWithAuth(
    `/api/sync/import-gpx/duplicates?fingerprint=${encodeURIComponent(fingerprint)}`,
    accessToken,
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to check for duplicate routes."));
  }
  const payload = await response.json();
  return payload.matches ?? [];
}

function parseImportEvent(raw: string): ImportGpxEvent | null {
  try {
    return JSON.parse(raw) as ImportGpxEvent;
  } catch {
    return null;
  }
}

function parseCompanionBundle(payload: unknown): CompanionBundle {
  const prepared = prepareCompanionBundle(payload);
  if (!prepared.bundle) {
    throw new Error(formatBundlePrepareFailure(prepared).replace("from cloud", "from import"));
  }
  return prepared.bundle;
}

export async function importGpxStream(
  accessToken: string,
  options: ImportGpxOptions,
  onEvent: (event: ImportGpxEvent) => void,
): Promise<ImportGpxResult> {
  if (!getApiBaseUrl()) {
    throw new Error(
      "Route analysis server is not configured. Set VITE_API_BASE_URL for mobile GPX import.",
    );
  }

  const form = new FormData();
  form.append("file", options.file, options.file.name);
  if (options.name?.trim()) {
    form.append("name", options.name.trim());
  }
  form.append("conflict_action", options.conflictAction ?? "create");
  if (options.replaceRaceId) {
    form.append("replace_race_id", options.replaceRaceId);
  }

  const response = await fetchWithAuth("/api/sync/import-gpx", accessToken, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "GPX import failed."));
  }
  if (!response.body) {
    throw new Error("Import stream unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ImportGpxResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.split("\n").find((entry) => entry.startsWith("data: "));
      if (!line) {
        continue;
      }
      const event = parseImportEvent(line.slice(6));
      if (!event) {
        continue;
      }
      onEvent(event);
      if (event.type === "complete") {
        result = {
          raceId: event.race_id,
          bundle: parseCompanionBundle(event.bundle),
          fingerprint: event.fingerprint,
          companionRevision: event.bundle.revision ?? event.bundle.bundle_version ?? null,
        };
      }
      if (event.type === "synced") {
        if (result) {
          result.companionRevision = event.sync.companion_revision;
        }
      }
      if (event.type === "error") {
        throw new Error(event.detail);
      }
    }
  }

  if (!result) {
    throw new Error("Import finished without a bundle.");
  }
  return result;
}
