import { useCallback, useRef, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { applyVerificationToBundle, revertVerificationOnBundle } from "@shared/race/applyVerificationToBundle";
import type { CompanionStop } from "@shared/types/sync";
import type {
  CompanionVerificationSubmission,
  CompanionVerificationUpdates,
} from "@shared/types/verification";
import { useCompanion } from "../context/CompanionContext";
import { deleteVerification, queueVerification } from "../lib/verificationQueue";
import { syncPendingVerifications } from "../sync/useVerificationSync";

const UNDO_MS = 4000;

export interface PendingUndo {
  id: string;
  zoneId: number;
  stopName: string;
  priorStop: CompanionStop;
}

export function useVerificationActions(userId: string | null) {
  const { session } = useAuth();
  const { bundle, updateBundle, gps } = useCompanion();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const [undo, setUndo] = useState<PendingUndo | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const scheduleUndo = useCallback(
    (entry: PendingUndo) => {
      clearUndoTimer();
      setUndo(entry);
      undoTimerRef.current = setTimeout(() => {
        setUndo(null);
        undoTimerRef.current = null;
      }, UNDO_MS);
    },
    [clearUndoTimer],
  );

  const submitVerification = useCallback(
    async (stop: CompanionStop, updates: CompanionVerificationUpdates) => {
      const priorStop = bundle.stops.find((item) => item.zoneId === stop.zoneId);
      if (!priorStop) {
        return;
      }
      const submission: CompanionVerificationSubmission = {
        id: crypto.randomUUID(),
        raceId: bundle.race.id,
        zoneId: stop.zoneId,
        stopName: stop.name,
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
      scheduleUndo({
        id: submission.id,
        zoneId: stop.zoneId,
        stopName: stop.name,
        priorStop,
      });
      if (online && session?.access_token) {
        void syncPendingVerifications(session.access_token, userId, online);
      }
    },
    [bundle, gps.lat, gps.lon, online, scheduleUndo, session?.access_token, updateBundle, userId],
  );

  const performUndo = useCallback(async () => {
    if (!undo) {
      return;
    }
    clearUndoTimer();
    setUndo(null);
    const reverted = revertVerificationOnBundle(bundle, undo.zoneId, undo.priorStop);
    updateBundle(reverted);
    await deleteVerification(undo.id);
  }, [bundle, clearUndoTimer, undo, updateBundle]);

  return { submitVerification, undo, performUndo };
}
