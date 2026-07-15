import { fetchCompanionBundle, fetchOriginalGpx } from "@shared/api/sync";
import type { CompanionBundle } from "@shared/types/sync";
import { saveCompanionBundle, saveOriginalGpx } from "../db";

export async function downloadRaceAssets(
  accessToken: string,
  raceId: string,
  userId: string | null | undefined,
): Promise<CompanionBundle> {
  const [bundle, gpx] = await Promise.all([
    fetchCompanionBundle(accessToken, raceId, userId),
    fetchOriginalGpx(accessToken, raceId, userId),
  ]);
  await saveCompanionBundle(bundle);
  await saveOriginalGpx(raceId, gpx);
  return bundle;
}
