import type { SettingsSnapshot } from "./types";

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response.json().catch(() => ({ detail: fallback }));
  const detail = error.detail;
  return typeof detail === "string" ? detail : fallback;
}

export async function fetchAppSettings(): Promise<SettingsSnapshot> {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to load settings."));
  }
  return response.json();
}

export async function patchAppSettings(body: {
  planning?: Partial<SettingsSnapshot["planning"]>;
  analysis?: Partial<SettingsSnapshot["analysis"]>;
  appearance?: Partial<SettingsSnapshot["appearance"]>;
}): Promise<SettingsSnapshot> {
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to save settings."));
  }
  return response.json();
}

export async function fetchRaceSettings(raceId: string): Promise<SettingsSnapshot> {
  const response = await fetch(`/api/races/${raceId}/settings`);
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to load race settings."));
  }
  return response.json();
}

export async function patchRaceSettings(
  raceId: string,
  body: {
    use_app_defaults?: boolean;
    planning?: Partial<SettingsSnapshot["planning"]>;
  },
): Promise<SettingsSnapshot> {
  const response = await fetch(`/api/races/${raceId}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to save race settings."));
  }
  return response.json();
}

export function formatStorage(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
