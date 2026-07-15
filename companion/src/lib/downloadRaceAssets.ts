import { fetchCompanionBundle, fetchOriginalGpx } from "@shared/api/sync";
import { applyVerificationToBundle } from "@shared/race/applyVerificationToBundle";
import type { CompanionBundle } from "@shared/types/sync";
import { logSyncDebug } from "@shared/sync/syncDebugLog";
import { invalidateStaleBundle, saveCompanionBundle, saveOriginalGpx } from "../db";
import { loadPendingVerifications } from "./verificationQueue";

export async function downloadRaceAssets(
  accessToken: string,
  raceId: string,
  userId: string | null | undefined,
): Promise<CompanionBundle> {
  const pending = await loadPendingVerifications(raceId);
  await invalidateStaleBundle(raceId);
  logSyncDebug("download", `Fetching race ${raceId} with self-healing sync`);

  const [downloaded, gpx] = await Promise.all([
    fetchCompanionBundle(accessToken, raceId, userId),
    fetchOriginalGpx(accessToken, raceId, userId),
  ]);
  let bundle: CompanionBundle = downloaded;
  for (const { synced: _synced, ...submission } of pending) {
    bundle = applyVerificationToBundle(bundle, submission);
  }
  if (pending.length > 0) {
    logSyncDebug("download", `Re-applied ${pending.length} pending verification(s) after download`);
  }
  await saveCompanionBundle(bundle);
  await saveOriginalGpx(raceId, gpx);
  return bundle;
}
