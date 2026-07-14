import { useRegisterSW } from "virtual:pwa-register/react";

export default function AppUpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegistered(registration) {
      if (registration) {
        window.setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-4 z-[100] flex justify-center"
      style={{ top: "max(54px, env(safe-area-inset-top, 0px))" }}
    >
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="min-h-[44px] rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
      >
        Update available — tap to reload
      </button>
    </div>
  );
}
