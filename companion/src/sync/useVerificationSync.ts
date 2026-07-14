import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { submitCompanionVerifications } from "@shared/api/verifications";
import {
  loadPendingVerifications,
  markVerificationsSynced,
  removeSyncedVerifications,
} from "../lib/verificationQueue";

export async function syncPendingVerifications(
  accessToken: string,
  userId: string | null,
  online: boolean,
): Promise<void> {
  if (!online) {
    return;
  }
  const pending = await loadPendingVerifications();
  if (pending.length === 0) {
    return;
  }
  const result = await submitCompanionVerifications(
    accessToken,
    pending.map(({ synced: _synced, ...submission }) => submission),
    userId,
  );
  const accepted = new Set(result.accepted ?? []);
  const syncedIds = pending.filter((item) => accepted.has(item.id)).map((item) => item.id);
  if (syncedIds.length > 0) {
    await markVerificationsSynced(syncedIds);
    await removeSyncedVerifications();
  }
}

export function useVerificationSync(online: boolean, userId: string | null) {
  const { session } = useAuth();
  const syncingRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (!session?.access_token || syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    try {
      await syncPendingVerifications(session.access_token, userId, online);
    } catch {
      // Keep queued for next attempt.
    } finally {
      syncingRef.current = false;
    }
  }, [online, session?.access_token, userId]);

  useEffect(() => {
    if (online && session?.access_token) {
      void syncNow();
    }
  }, [online, session?.access_token, syncNow]);

  useEffect(() => {
    const onOnline = () => void syncNow();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncNow]);

  return { syncVerificationsNow: syncNow };
}
