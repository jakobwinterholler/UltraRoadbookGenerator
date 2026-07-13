import { useEffect, useRef } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { pushAllLocalRaces } from "@shared/api/sync";
import { updateDeviceLastActive } from "@shared/sync/deviceProfile";
import { setAuthAccessToken } from "../api/authFetch";
import { recordSyncSuccess } from "./useAccountSync";

const IMPORTED_KEY = "cloud-sync-imported";

export function AuthSyncBridge() {
  const { accessToken, user, configured } = useAuth();
  const importedRef = useRef(false);

  useEffect(() => {
    setAuthAccessToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!configured || !accessToken || !user || importedRef.current) {
      return;
    }
    const alreadyImported = localStorage.getItem(`${IMPORTED_KEY}:${user.id}`) === "1";
    if (alreadyImported) {
      importedRef.current = true;
      return;
    }

    importedRef.current = true;
    void updateDeviceLastActive("desktop");
    void pushAllLocalRaces(accessToken)
      .then(() => {
        localStorage.setItem(`${IMPORTED_KEY}:${user.id}`, "1");
        recordSyncSuccess(user.id);
      })
      .catch(() => {
        importedRef.current = false;
      });
  }, [accessToken, configured, user]);

  return null;
}
