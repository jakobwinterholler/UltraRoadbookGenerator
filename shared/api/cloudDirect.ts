import { getSupabaseClient } from "../auth/supabaseClient";
import type { CompanionBundle, SyncRaceSummary } from "../types/sync";
import { isCompanionBundle } from "../types/sync";

/** Read cloud races directly from Supabase (Companion production — no API server needed). */
export async function fetchSyncRacesDirect(): Promise<SyncRaceSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("races")
    .select(
      "id,name,distance_km,elevation_gain_m,companion_revision,updated_at,analyzed_at,has_bundle",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((race) => ({
    id: race.id,
    name: race.name,
    distance_km: race.distance_km,
    elevation_gain_m: race.elevation_gain_m,
    companion_revision: race.companion_revision ?? 0,
    updated_at: race.updated_at,
    analyzed_at: race.analyzed_at,
    has_bundle: Boolean(race.has_bundle),
  }));
}

/** Download companion bundle from Supabase Storage. */
export async function fetchCompanionBundleDirect(
  userId: string,
  raceId: string,
): Promise<CompanionBundle> {
  const supabase = getSupabaseClient();
  const path = `${userId}/${raceId}/companion-bundle.json`;
  const { data, error } = await supabase.storage.from("race-assets").download(path);

  if (error) {
    throw new Error(error.message);
  }

  const parsed: unknown = JSON.parse(await data.text());
  if (!isCompanionBundle(parsed)) {
    throw new Error("Invalid companion bundle from cloud.");
  }
  return parsed;
}
