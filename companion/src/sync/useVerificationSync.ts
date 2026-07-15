import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { submitCompanionVerifications } from "@shared/api/verifications";
import {
  applySyncedVerificationsToBundle,
} from "@shared/race/applyVerificationToBundle";
import type { CompanionBundle } from "@shared/types/sync";
import {
  loadPendingVerifications,
  markVerificationsSynced,
  removeSyncedVerifications,
} from "../lib/verificationQueue";

export async function syncPendingVerifications(
  accessToken: string,
  userId: string | null,
  online: boolean,
  options?: {
    bundle: CompanionBundle | null;
    onBundleUpdate?: (bundle: CompanionBundle) => void;
  },
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
  const syncedItems = pending.filter((item) => accepted.has(item.id));
  const syncedIds = syncedItems.map((item) => item.id);
  if (syncedIds.length > 0) {
    await markVerificationsSynced(syncedIds);
    await removeSyncedVerifications();
    if (options?.bundle && options.onBundleUpdate) {
      const next = applySyncedVerificationsToBundle(
        options.bundle,
        syncedItems.map(({ synced: _synced, ...submission }) => submission),
      );
      options.onBundleUpdate(next);
    }
  }
}

export function useVerificationSync(
  online: boolean,
  userId: string | null,
  options?: {
    bundle: CompanionBundle | null;
    onBundleUpdate?: (bundle: CompanionBundle) => void;
  },
) {
  const { session } = useAuth();
  const syncingRef = useRef(false);
  const bundleRef = useRef(options?.bundle ?? null);
  bundleRef.current = options?.bundle ?? null;

  const syncNow = useCallback(async () => {
    if (!session?.access_token || syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    try {
      await syncPendingVerifications(session.access_token, userId, online, {
        bundle: bundleRef.current,
        onBundleUpdate: options?.onBundleUpdate,
      });
    } catch {
      // Keep queued for next attempt.
    } finally {
      syncingRef.current = false;
    }
  }, [online, options?.onBundleUpdate, session?.access_token, userId]);

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
