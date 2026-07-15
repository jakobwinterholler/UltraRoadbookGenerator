import { useEffect, useRef, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import {
  getAuthProviderLabel,
  getAvatarUrl,
  getConnectedSince,
  getDisplayName,
} from "@shared/auth/profile";
import { Avatar } from "@shared/ui/AuthScreens";
import { SyncStatusBadge, type SyncIndicator } from "@shared/ui/SyncStatusBadge";
import { readDevicesFromMetadata, updateDeviceLastActive } from "@shared/sync/deviceProfile";
import {
  companionConnectionLabel,
  desktopConnectionLabel,
} from "@shared/ui/accountDevices";
import { formatStorage } from "@shared/ui/formatStorage";
import { estimateCompanionStorageBytes, clearCompanionData } from "../db";
import { useCompanionSync } from "../sync/useCompanionSync";
import { useCloudRaceList } from "../sync/useCloudRaceList";

function formatBytes(bytes: number | null): string {
  return formatStorage(bytes);
}

function resolveSyncStatus(syncing: boolean, syncError: string | null): SyncIndicator {
  if (syncing) {
    return "syncing";
  }
  if (syncError) {
    return "waiting-to-sync";
  }
  return "cloud-synced";
}

function DeleteAccountDialog({
  open,
  step,
  busy,
  onClose,
  onContinue,
  onConfirm,
}: {
  open: boolean;
  step: 1 | 2;
  busy: boolean;
  onClose: () => void;
  onContinue: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      setTyped("");
    }
  }, [open, step]);

  if (!open) {
    return null;
  }

  const canConfirm = typed.trim().toUpperCase() === "DELETE" && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md animate-fade-in rounded-2xl border border-white/10 bg-[#111] p-6">
        {step === 1 ? (
          <>
            <h3 className="text-lg font-semibold text-white">Delete account?</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              This signs you out and removes all downloaded races from this phone. Your cloud
              account and races remain until you contact support to permanently delete them.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="min-h-[44px] rounded-xl border border-white/12 px-4 py-2 text-sm text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onContinue}
                disabled={busy}
                className="min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white">Confirm deletion</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Type <span className="font-mono font-semibold text-white">DELETE</span> to confirm
              removing your account from this device.
            </p>
            <input
              type="text"
              value={typed}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(event) => setTyped(event.target.value)}
              placeholder="DELETE"
              className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-red-400/50"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="min-h-[44px] rounded-xl border border-white/12 px-4 py-2 text-sm text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                className="min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Removing…" : "Delete account"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AccountScreen({ embedded = false }: { embedded?: boolean }) {
  const { user, signOut } = useAuth();
  const {
    syncing,
    lastSyncLabel,
    downloadedCount,
    cloudRaceCount,
    syncError,
    syncNow,
  } = useCompanionSync();
  const { races: cloudRaces } = useCloudRaceList();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const deviceRecorded = useRef(false);

  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);
  const connectedSince = getConnectedSince(user);
  const authProvider = getAuthProviderLabel(user);
  const devices = readDevicesFromMetadata(user?.user_metadata);
  const companionConnected = companionConnectionLabel(devices);
  const desktopConnected = desktopConnectionLabel(devices);
  const syncStatus = resolveSyncStatus(syncing, syncError);

  useEffect(() => {
    if (!user || deviceRecorded.current) {
      return;
    }
    deviceRecorded.current = true;
    void updateDeviceLastActive("companion");
  }, [user]);

  useEffect(() => {
    void estimateCompanionStorageBytes().then(setStorageBytes);
  }, [downloadedCount, syncing]);

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

  async function handleDeleteAccount() {
    setSigningOut(true);
    try {
      await clearCompanionData();
      await signOut();
      setDeleteStep(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-4 ${
        embedded ? "pt-4" : "pt-safe-top"
      }`}
    >
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} imageUrl={avatarUrl} size="lg" variant="dark" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-white">{displayName}</p>
            <p className="truncate text-sm text-white/50">{user?.email}</p>
            {connectedSince ? (
              <p className="mt-1 text-xs text-white/35">Connected since {connectedSince}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Google account</span>
            <span className="font-medium text-white">
              {authProvider === "Google" ? user?.email : authProvider}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Desktop connected</span>
            <span className="font-medium text-white">{desktopConnected}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Companion connected</span>
            <span className="font-medium text-white">{companionConnected}</span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/40">Sync</h2>
          <SyncStatusBadge status={syncStatus} variant="dark" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Races in cloud</span>
            <span className="font-medium text-white">{cloudRaceCount ?? cloudRaces.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Downloaded races</span>
            <span className="font-medium text-white">{downloadedCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Storage used</span>
            <span className="font-medium text-white">{formatBytes(storageBytes)}</span>
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
          className="mt-5 min-h-[48px] w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </section>

      <section className="mt-4 rounded-2xl border border-red-500/20 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white">Account actions</h2>
        <p className="mt-1 text-xs text-white/45">Sign out or remove local data from this device.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="min-h-[44px] rounded-xl border border-white/12 px-5 py-2.5 text-sm font-medium text-white/80"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => setDeleteStep(1)}
            className="min-h-[44px] rounded-xl border border-red-500/30 px-5 py-2.5 text-sm font-medium text-red-300"
          >
            Delete account
          </button>
        </div>
      </section>

      <DeleteAccountDialog
        open={deleteStep > 0}
        step={deleteStep === 2 ? 2 : 1}
        busy={signingOut}
        onClose={() => setDeleteStep(0)}
        onContinue={() => setDeleteStep(2)}
        onConfirm={() => void handleDeleteAccount()}
      />

      <p className="pb-2 text-center text-[11px] text-white/25">Companion v0.1.5</p>
    </div>
  );
}
