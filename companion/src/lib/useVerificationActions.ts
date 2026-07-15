import { useCallback } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { applyVerificationToBundle } from "@shared/race/applyVerificationToBundle";
import { collectAllBundlePois, resolveRenderedStop } from "@shared/race/bundlePois";
import { sameStop, stopIdentity } from "@shared/race/stopMatching";
import type { CompanionStop } from "@shared/types/sync";
import type {
  CompanionVerificationSubmission,
  CompanionVerificationUpdates,
} from "@shared/types/verification";
import { useCompanion } from "../context/CompanionContext";
import { liveBundleRef } from "./liveBundleRef";
import { queueVerification } from "../lib/verificationQueue";
import { syncPendingVerifications } from "../sync/useVerificationSync";

export interface VerificationSubmitResult {
  ok: boolean;
  error?: string;
}

export function useVerificationActions(userId: string | null) {
  const { session } = useAuth();
  const { bundle, updateBundle, gps } = useCompanion();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  const submitVerification = useCallback(
    async (
      stop: CompanionStop,
      updates: CompanionVerificationUpdates,
    ): Promise<VerificationSubmitResult> => {
      const rendered = resolveRenderedStop(bundle, stop);
      const knownPoi = collectAllBundlePois(bundle).find((entry) => sameStop(entry.stop, rendered));
      if (!knownPoi) {
        return { ok: false, error: "Stop not found in this route bundle." };
      }

      const poiId = rendered.poiId ?? knownPoi.poiId ?? stopIdentity(rendered);
      const submission: CompanionVerificationSubmission = {
        id: crypto.randomUUID(),
        raceId: bundle.race.id,
        zoneId: rendered.zoneId,
        poiId,
        stopName: rendered.name,
        submittedAt: new Date().toISOString(),
        source: "companion",
        reviewStatus: "pending",
        lat: gps.lat ?? undefined,
        lon: gps.lon ?? undefined,
        updates,
      };
      const nextBundle = applyVerificationToBundle(bundle, submission);
      updateBundle(nextBundle);
      await queueVerification(submission);
      if (online && session?.access_token) {
        void syncPendingVerifications(session.access_token, userId, online, {
          getBundle: () => liveBundleRef.current,
          onBundleUpdate: updateBundle,
        });
      }
      return { ok: true };
    },
    [bundle, gps.lat, gps.lon, online, session?.access_token, updateBundle, userId],
  );

  return { submitVerification };
}
