import { fetchWithAuth, getApiBaseUrl, parseApiError } from "./client";
import { fetchCompanionBundleDirect, fetchSyncRacesDirect } from "./cloudDirect";
import type { AuthProfile, CompanionBundle, SyncPushAllResult, SyncPushRaceResult, SyncRaceSummary } from "../types/sync";

export async function fetchAuthProfile(accessToken: string): Promise<AuthProfile> {
  const response = await fetchWithAuth("/api/auth/me", accessToken);
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to load profile."));
  }
  return response.json();
}

export async function fetchSyncRaces(accessToken: string): Promise<SyncRaceSummary[]> {
  if (!getApiBaseUrl()) {
    return fetchSyncRacesDirect();
  }
  const response = await fetchWithAuth("/api/sync/races", accessToken);
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to load cloud races."));
  }
  const payload = await response.json();
  const races: SyncRaceSummary[] = payload.races ?? [];
  return races.map((race) => ({
    ...race,
    version: race.version ?? race.companion_revision,
    bundle_version: race.bundle_version ?? race.companion_revision,
  }));
}

export async function fetchCompanionBundle(
  accessToken: string,
  raceId: string,
  userId?: string | null,
): Promise<CompanionBundle> {
  if (!getApiBaseUrl()) {
    if (!userId) {
      throw new Error("User id required to download race.");
    }
    return fetchCompanionBundleDirect(userId, raceId);
  }
  const response = await fetchWithAuth(`/api/sync/races/${raceId}/bundle`, accessToken);
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to download race."));
  }
  return response.json();
}

export async function pushRaceNow(accessToken: string, raceId: string): Promise<SyncPushRaceResult> {
  const response = await fetchWithAuth("/api/sync/push-now", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ race_id: raceId }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to sync race."));
  }
  const result = (await response.json()) as SyncPushRaceResult;
  return {
    ...result,
    companion_revision: result.companion_revision,
  };
}

export async function pushAllLocalRaces(accessToken: string): Promise<SyncPushAllResult> {
  const response = await fetchWithAuth("/api/sync/push-all", accessToken, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to sync local races."));
  }
  return response.json();
}

export async function queueRacePush(accessToken: string, raceId: string): Promise<void> {
  const response = await fetchWithAuth("/api/sync/push", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ race_id: raceId }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to queue race sync."));
  }
}
