import type { CompanionBundle, SyncRaceSummary } from "@shared/types/sync";

const DB_NAME = "race-companion";
const DB_VERSION = 3;
const BUNDLE_STORE = "bundles";
const LIST_STORE = "raceList";
const META_STORE = "meta";
const ACTIVE_KEY = "active-race-id";

interface StoredRaceListItem extends SyncRaceSummary {
  downloadedRevision: number | null;
  offlineReady: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BUNDLE_STORE)) {
        db.createObjectStore(BUNDLE_STORE, { keyPath: "race.id" });
      }
      if (!db.objectStoreNames.contains(LIST_STORE)) {
        db.createObjectStore(LIST_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains("verifications")) {
        const store = db.createObjectStore("verifications", { keyPath: "id" });
        store.createIndex("raceId", "raceId", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB failed."));
  });
}

export async function saveRaceList(races: StoredRaceListItem[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LIST_STORE, "readwrite");
    const store = tx.objectStore(LIST_STORE);
    store.clear();
    for (const race of races) {
      store.put(race);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save race list."));
  });
  db.close();
}

export async function loadRaceList(): Promise<StoredRaceListItem[]> {
  const db = await openDb();
  const races = await new Promise<StoredRaceListItem[]>((resolve, reject) => {
    const tx = db.transaction(LIST_STORE, "readonly");
    const request = tx.objectStore(LIST_STORE).getAll();
    request.onsuccess = () => resolve((request.result as StoredRaceListItem[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to load race list."));
  });
  db.close();
  return races.sort((left, right) =>
    (right.updated_at ?? "").localeCompare(left.updated_at ?? ""),
  );
}

export async function saveCompanionBundle(bundle: CompanionBundle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([BUNDLE_STORE, LIST_STORE], "readwrite");
    tx.objectStore(BUNDLE_STORE).put(bundle);

    const listStore = tx.objectStore(LIST_STORE);
    const getRequest = listStore.get(bundle.race.id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as StoredRaceListItem | undefined;
      const revision = bundle.revision ?? bundle.bundle_version ?? existing?.companion_revision ?? 0;
      if (existing) {
        listStore.put({
          ...existing,
          downloadedRevision: revision,
          offlineReady: true,
          readiness_score: bundle.dashboardStats?.readinessScore ?? existing.readiness_score ?? null,
        });
        return;
      }
      listStore.put({
        id: bundle.race.id,
        name: bundle.race.name,
        distance_km: bundle.race.distanceKm,
        elevation_gain_m: bundle.race.elevationGainM,
        companion_revision: revision,
        version: revision,
        bundle_version: revision,
        updated_at: bundle.syncedAt ?? bundle.exportedAt,
        analyzed_at: bundle.race.analyzedAt ?? null,
        has_bundle: true,
        downloadedRevision: revision,
        offlineReady: true,
        readiness_score: bundle.dashboardStats?.readinessScore ?? null,
      });
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save race."));
  });
  localStorage.setItem(ACTIVE_KEY, bundle.race.id);
  db.close();
}

export async function loadActiveCompanionBundle(): Promise<CompanionBundle | null> {
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (!activeId) {
    return null;
  }
  return loadCompanionBundle(activeId);
}

export async function loadCompanionBundle(raceId: string): Promise<CompanionBundle | null> {
  const db = await openDb();
  const bundle = await new Promise<CompanionBundle | null>((resolve, reject) => {
    const tx = db.transaction(BUNDLE_STORE, "readonly");
    const request = tx.objectStore(BUNDLE_STORE).get(raceId);
    request.onsuccess = () => resolve((request.result as CompanionBundle | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to load race."));
  });
  db.close();
  return bundle;
}

export async function clearCompanionData(): Promise<void> {
  localStorage.removeItem(ACTIVE_KEY);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([BUNDLE_STORE, LIST_STORE, META_STORE], "readwrite");
    tx.objectStore(BUNDLE_STORE).clear();
    tx.objectStore(LIST_STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to clear data."));
  });
  db.close();
}

export async function setActiveRaceId(raceId: string): Promise<void> {
  localStorage.setItem(ACTIVE_KEY, raceId);
}

export async function estimateCompanionStorageBytes(): Promise<number | null> {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === "number") {
        return estimate.usage;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export type { StoredRaceListItem };
