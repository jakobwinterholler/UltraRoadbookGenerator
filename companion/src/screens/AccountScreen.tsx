import { useEffect, useRef, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { getAvatarUrl, getDisplayName } from "@shared/auth/profile";
import { Avatar } from "@shared/ui/AuthScreens";
import { updateDeviceLastActive } from "@shared/sync/deviceProfile";
import { clearCompanionData } from "../db";
import { useCompanionSync } from "../sync/useCompanionSync";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const {
    syncing,
    lastSyncLabel,
    downloadedCount,
    syncError,
    syncNow,
  } = useCompanionSync();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deviceRecorded = useRef(false);

  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);

  useEffect(() => {
    if (!user || deviceRecorded.current) {
      return;
    }
    deviceRecorded.current = true;
    void updateDeviceLastActive("companion");
  }, [user]);

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
      await clearCompanionData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#0a0a0a] px-5 pb-6 pt-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} imageUrl={avatarUrl} size="lg" variant="dark" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-white">{displayName}</p>
            <p className="truncate text-sm text-white/50">{user?.email}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/40">
          Offline data
        </h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Downloaded races</span>
            <span className="font-medium text-white">{downloadedCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Storage used</span>
            <span className="font-medium text-white">On device</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Last sync</span>
            <span className="font-medium text-white">{lastSyncLabel}</span>
          </div>
        </div>

        {(syncError || error) && (
          <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {syncError ?? error}
          </p>
        )}

        <button
          type="button"
          disabled={syncing}
          onClick={() => void syncNow().catch(() => undefined)}
          className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </section>

      <button
        type="button"
        disabled={signingOut}
        onClick={() => void handleSignOut()}
        className="mt-4 w-full rounded-xl border border-white/12 px-4 py-3 text-sm font-medium text-white/80"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
