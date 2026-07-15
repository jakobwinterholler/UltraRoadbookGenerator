import { usePwaUpdate } from "../pwa/PwaUpdateProvider";

export default function AppUpdateBanner() {
  const {
    updateAvailable,
    applying,
    applyUpdate,
    dismissUpdate,
    versionLabel,
    pendingVersionLabel,
  } = usePwaUpdate();

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-[90] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md animate-fade-in rounded-2xl border border-white/12 bg-[#141414]/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-md">
        <p className="text-sm font-semibold text-white">New version available</p>
        {pendingVersionLabel ? (
          <p className="mt-0.5 text-xs tabular-nums text-white/45">
            {versionLabel} → {pendingVersionLabel}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-white/45">A newer build is ready to install.</p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={applying}
            onClick={() => void applyUpdate()}
            className="min-h-[40px] flex-1 rounded-xl bg-white px-3 text-sm font-semibold text-[#0a0a0a] transition hover:bg-white/90 disabled:opacity-60"
          >
            {applying ? "Updating…" : "Update now"}
          </button>
          <button
            type="button"
            disabled={applying}
            onClick={dismissUpdate}
            className="min-h-[40px] rounded-xl border border-white/15 px-4 text-sm font-medium text-white/70 transition hover:bg-white/5"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
