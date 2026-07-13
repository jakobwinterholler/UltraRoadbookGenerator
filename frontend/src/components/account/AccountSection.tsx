import { useEffect, useRef, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { getAvatarUrl, getDisplayName } from "@shared/auth/profile";
import { GoogleSignInButton } from "@shared/ui/GoogleSignInButton";
import { Avatar, SigningInScreen } from "@shared/ui/AuthScreens";
import { formatDeviceLastActive } from "@shared/sync/deviceActivity";
import { readDevicesFromMetadata, updateDeviceLastActive } from "@shared/sync/deviceProfile";
import type { AccountSettings } from "../../settings/types";
import { formatStorage } from "../../settings/api";
import { useAccountSync } from "../../sync/useAccountSync";

interface AccountSectionProps {
  account: AccountSettings;
}

function FeatureRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-muted">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
        ✓
      </span>
      {children}
    </li>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function DeleteAccountModal({
  open,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-card animate-fade-in">
        <h3 className="text-lg font-semibold text-ink">Delete account?</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This signs you out on all devices and removes local sync data from this computer.
          To permanently delete your cloud account and races, contact support.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountSection({ account }: AccountSectionProps) {
  const {
    configured,
    user,
    signingIn,
    signInWithGoogle,
    signOut,
    authError: oauthError,
  } = useAuth();
  const {
    syncing,
    cloudRaceCount,
    lastSyncLabel,
    syncError,
    syncNow,
  } = useAccountSync();
  const [localError, setLocalError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const deviceRecorded = useRef(false);

  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);
  const devices = readDevicesFromMetadata(user?.user_metadata);

  useEffect(() => {
    if (!user || deviceRecorded.current) {
      return;
    }
    deviceRecorded.current = true;
    void updateDeviceLastActive("desktop");
  }, [user]);

  async function handleSignIn() {
    setLocalError(null);
    setRedirecting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign in failed.");
      setRedirecting(false);
    }
  }

  async function handleSignOut() {
    setLocalError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign out failed.");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    setSigningOut(true);
    try {
      localStorage.removeItem(`cloud-sync-imported:${user?.id ?? ""}`);
      await signOut();
      setShowDelete(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  }

  const authError = localError ?? oauthError;
  const connected = Boolean(user && account.cloud_sync_enabled);

  if (signingIn) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
        <SigningInScreen message="Signing you in…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="animate-fade-in">
        <div className="mx-auto max-w-lg rounded-2xl border border-line bg-card px-8 py-12 text-center shadow-card">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
            Sign in to automatically sync your races between your computer and your phone.
          </p>

          <div className="mt-8 flex justify-center">
            <GoogleSignInButton
              onClick={() => void handleSignIn()}
              disabled={!configured}
              loading={redirecting}
            />
          </div>

          {!configured ? (
            <p className="mt-4 text-xs text-muted">
              Cloud sign-in requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </p>
          ) : null}

          {authError ? (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{authError}</p>
          ) : null}

          <ul className="mx-auto mt-10 max-w-xs space-y-3 text-left">
            <FeatureRow>Automatic cloud sync</FeatureRow>
            <FeatureRow>Your races on every device</FeatureRow>
            <FeatureRow>Offline Companion app</FeatureRow>
            <FeatureRow>Secure Google authentication</FeatureRow>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <section className="rounded-2xl border border-line bg-card p-8 shadow-card">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
          <Avatar name={displayName} imageUrl={avatarUrl} size="xl" />
          <div className="mt-5 sm:mt-0 sm:ml-6">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{displayName}</h2>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-ink">Cloud Sync</h3>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-success">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            {connected ? "Connected" : "Sign in required"}
          </span>
        </div>

        <div className="mt-4 divide-y divide-line/70">
          <StatRow label="Last sync" value={lastSyncLabel} />
          <StatRow
            label="Races in cloud"
            value={cloudRaceCount ?? account.storage.race_count}
          />
          <StatRow
            label="Storage used"
            value={formatStorage(account.storage.storage_bytes)}
          />
        </div>

        {(syncError || authError) && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {syncError ?? authError}
          </p>
        )}

        <button
          type="button"
          disabled={!account.cloud_sync_enabled || syncing}
          onClick={() => void syncNow().catch(() => undefined)}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>

        {!account.cloud_sync_enabled ? (
          <p className="mt-3 text-xs text-muted">
            Add SUPABASE_SECRET_KEY to enable race uploads to the cloud.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink">Devices</h3>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">MacBook</p>
              <p className="text-xs text-muted">Ultra Roadbook · This device</p>
            </div>
            <p className="text-xs text-muted">
              {formatDeviceLastActive(devices.desktop?.lastActive ?? new Date().toISOString())}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">iPhone Companion</p>
              <p className="text-xs text-muted">Race day app</p>
            </div>
            <p className="text-xs text-muted">
              {formatDeviceLastActive(devices.companion?.lastActive)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-card p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink">Danger zone</h3>
        <p className="mt-1 text-sm text-muted">Sign out or remove your account from this device.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => setShowDelete(true)}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700"
          >
            Delete account
          </button>
        </div>
      </section>

      <DeleteAccountModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => void handleDeleteAccount()}
        busy={signingOut}
      />
    </div>
  );
}
