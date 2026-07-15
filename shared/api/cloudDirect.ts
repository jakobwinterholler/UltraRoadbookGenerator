import { getSupabaseClient } from "../auth/supabaseClient";
import { resolveVerifiedStopRecord } from "../race/poiId";
import type { CompanionBundle, SyncRaceSummary } from "../types/sync";
import { isCompanionBundle } from "../types/sync";
import { validateCompanionBundle } from "../sync/bundleValidation";
import type { CompanionVerificationSubmission } from "../types/verification";

interface CloudRaceRow {
  id: string;
  name: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  companion_revision: number | null;
  updated_at: string | null;
  analyzed_at: string | null;
  has_bundle: boolean | null;
  preparation?: Record<string, unknown> | null;
}

function applyVerificationToPreparation(
  preparation: Record<string, unknown>,
  submission: CompanionVerificationSubmission,
): Record<string, unknown> {
  const verifiedStops = {
    ...(preparation.verified_stops as Record<string, unknown> | undefined),
  };
  const history = {
    ...(preparation.companion_verification_history as Record<string, unknown> | undefined),
  };
  const { updates } = submission;
  const key = submission.poiId ?? String(submission.zoneId);
  verifiedStops[key] = {
    status: updates.status,
    reject_reason: updates.rejectReason ?? null,
    reject_notes: updates.notes ?? null,
    updated_at: submission.submittedAt,
    poi_id: submission.poiId ?? null,
  };
  history[submission.id] = {
    ...submission,
    reviewStatus: "accepted",
    reviewedAt: new Date().toISOString(),
    reviewAction: "accept",
  };
  return {
    ...preparation,
    verified_stops: verifiedStops,
    companion_verification_history: history,
  };
}

function patchBundleFromPreparation(
  bundle: CompanionBundle,
  preparation: Record<string, unknown>,
  revision: number,
): CompanionBundle {
  const verifiedStops = (preparation.verified_stops ?? {}) as Record<
    string,
    { status?: string; reject_notes?: string; updated_at?: string }
  >;
  const stops = bundle.stops.map((stop) => {
    const { record } = resolveVerifiedStopRecord(
      verifiedStops as Record<string, unknown>,
      stop.zoneId,
      stop.poiId,
    );
    if (!record) {
      return stop;
    }
    if (record.status === "verified") {
      return {
        ...stop,
        verificationStatus: "verified" as const,
        verificationDate: (record.updated_at as string | undefined) ?? null,
      };
    }
    if (record.status === "rejected" || record.status === "deferred") {
      return {
        ...stop,
        verificationStatus: "needs_review" as const,
        notes: (record.reject_notes as string | undefined)?.trim() || stop.notes,
      };
    }
    return stop;
  });
  const verifiedCount = stops.filter((stop) => stop.verificationStatus === "verified").length;
  const unverifiedCount = stops.length - verifiedCount;
  return {
    ...bundle,
    revision,
    syncedAt: new Date().toISOString(),
    stops,
    dashboardStats: {
      ...bundle.dashboardStats,
      verifiedStops: verifiedCount,
      unverifiedStops: unverifiedCount,
      remainingStops: unverifiedCount,
      readinessScore: bundle.dashboardStats
        ? Math.round((verifiedCount / Math.max(stops.length, 1)) * bundle.dashboardStats.readinessScore)
        : Math.round((verifiedCount / Math.max(stops.length, 1)) * 100),
      readinessReasons: bundle.dashboardStats?.readinessReasons ?? [],
      remainingUnsupportedKm: bundle.dashboardStats?.remainingUnsupportedKm ?? 0,
    },
  };
}

/** Read cloud races directly from Supabase (Companion production — no API server needed). */
export async function fetchSyncRacesDirect(): Promise<SyncRaceSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("races")
    .select(
      "id,name,distance_km,elevation_gain_m,companion_revision,updated_at,analyzed_at,has_bundle,preparation",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((race: CloudRaceRow) => {
    const preparation = (race.preparation ?? {}) as Record<string, unknown>;
    return {
      id: race.id,
      name: race.name,
      distance_km: race.distance_km,
      elevation_gain_m: race.elevation_gain_m,
      companion_revision: race.companion_revision ?? 0,
      version: race.companion_revision ?? 0,
      bundle_version: race.companion_revision ?? 0,
      updated_at: race.updated_at,
      analyzed_at: race.analyzed_at,
      has_bundle: Boolean(race.has_bundle),
      bundle_checksum: (preparation.bundle_checksum as string | undefined) ?? null,
      bundle_schema_version: (preparation.bundle_schema_version as number | undefined) ?? null,
    };
  });
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
  const validation = validateCompanionBundle(parsed);
  if (!validation.valid) {
    throw new Error(`Bundle validation failed: ${validation.errors.join(", ")}`);
  }
  return parsed;
}

/** Download original route GPX from Supabase Storage. */
export async function fetchOriginalGpxDirect(userId: string, raceId: string): Promise<ArrayBuffer> {
  const supabase = getSupabaseClient();
  const path = `${userId}/${raceId}/route.gpx`;
  const { data, error } = await supabase.storage.from("race-assets").download(path);

  if (error) {
    throw new Error(error.message);
  }

  return data.arrayBuffer();
}

/** Submit companion verifications directly to Supabase (production companion — no API server). */
export async function submitCompanionVerificationsDirect(
  userId: string,
  raceId: string,
  submissions: CompanionVerificationSubmission[],
): Promise<{ accepted: string[] }> {
  if (submissions.length === 0) {
    return { accepted: [] };
  }

  const supabase = getSupabaseClient();
  const { data: row, error: fetchError } = await supabase
    .from("races")
    .select("id,preparation,companion_revision,has_bundle")
    .eq("id", raceId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!row) {
    throw new Error("Race not found.");
  }

  let preparation = (row.preparation ?? {}) as Record<string, unknown>;
  const accepted: string[] = [];
  for (const submission of submissions) {
    preparation = applyVerificationToPreparation(preparation, submission);
    accepted.push(submission.id);
  }

  const nextRevision = (row.companion_revision ?? 0) + 1;
  const updatedAt = new Date().toISOString();

  if (row.has_bundle) {
    const bundlePath = `${userId}/${raceId}/companion-bundle.json`;
    const { data: bundleBlob, error: bundleError } = await supabase.storage
      .from("race-assets")
      .download(bundlePath);
    if (bundleError) {
      throw new Error(bundleError.message);
    }
    const parsed: unknown = JSON.parse(await bundleBlob.text());
    if (!isCompanionBundle(parsed)) {
      throw new Error("Invalid companion bundle from cloud.");
    }
    const patched = patchBundleFromPreparation(parsed, preparation, nextRevision);
    const { error: uploadError } = await supabase.storage
      .from("race-assets")
      .upload(bundlePath, JSON.stringify(patched), {
        contentType: "application/json",
        upsert: true,
      });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
  }

  const { error: updateError } = await supabase
    .from("races")
    .update({
      preparation,
      companion_revision: nextRevision,
      updated_at: updatedAt,
    })
    .eq("id", raceId)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { accepted };
}
