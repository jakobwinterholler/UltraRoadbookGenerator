import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  APP_VERSION,
  fetchDeployedVersionManifest,
  formatAppVersion,
} from "../lib/appVersion";

const UPDATE_CHECK_MS = 2 * 60 * 1000;

interface PwaUpdateContextValue {
  appVersion: string;
  pendingVersion: string | null;
  updateAvailable: boolean;
  applying: boolean;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  versionLabel: string;
  pendingVersionLabel: string | null;
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null);

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const refreshPendingVersion = useCallback(async () => {
    const manifest = await fetchDeployedVersionManifest();
    if (manifest && manifest.version !== APP_VERSION) {
      setPendingVersion(manifest.version);
      return manifest.version;
    }
    setPendingVersion(null);
    return null;
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegistered(registration) {
      registrationRef.current = registration ?? null;
    },
    onNeedRefresh() {
      setDismissed(false);
      void refreshPendingVersion();
    },
  });

  useEffect(() => {
    if (needRefresh) {
      void refreshPendingVersion();
    }
  }, [needRefresh, refreshPendingVersion]);

  useEffect(() => {
    const checkForUpdate = () => {
      void registrationRef.current?.update();
    };

    checkForUpdate();
    const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };
    const onFocus = () => {
      checkForUpdate();
    };
    const onOnline = () => {
      checkForUpdate();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    setApplying(true);
    try {
      await updateServiceWorker(true);
    } finally {
      setApplying(false);
    }
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  const updateAvailable = needRefresh && !dismissed;

  const value = useMemo<PwaUpdateContextValue>(
    () => ({
      appVersion: APP_VERSION,
      pendingVersion,
      updateAvailable,
      applying,
      applyUpdate,
      dismissUpdate,
      versionLabel: formatAppVersion(APP_VERSION),
      pendingVersionLabel: pendingVersion ? formatAppVersion(pendingVersion) : null,
    }),
    [applying, applyUpdate, dismissUpdate, pendingVersion, updateAvailable],
  );

  return <PwaUpdateContext.Provider value={value}>{children}</PwaUpdateContext.Provider>;
}

export function usePwaUpdate(): PwaUpdateContextValue {
  const context = useContext(PwaUpdateContext);
  if (!context) {
    throw new Error("usePwaUpdate must be used within PwaUpdateProvider.");
  }
  return context;
}
