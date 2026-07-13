import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSyncRaces } from "@shared/api/sync";
import { useAuth } from "@shared/auth/AuthProvider";
import type { SyncRaceSummary } from "@shared/types/sync";

export function useDesktopCloudRaces() {
  const { accessToken, user } = useAuth();
  const [cloudRaces, setCloudRaces] = useState<SyncRaceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setCloudRaces([]);
      return;
    }
    setLoading(true);
    try {
      const races = await fetchSyncRaces(accessToken);
      setCloudRaces(races);
    } catch {
      setCloudRaces([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && user) {
      void refresh();
    } else {
      setCloudRaces([]);
    }
  }, [accessToken, refresh, user]);

  const cloudById = useMemo(
    () => new Map(cloudRaces.map((race) => [race.id, race])),
    [cloudRaces],
  );

  return { cloudRaces, cloudById, loading, refresh };
}
