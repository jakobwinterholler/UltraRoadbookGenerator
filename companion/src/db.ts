import type { CompanionBundle } from "./types";

const DB_NAME = "race-companion";
const DB_VERSION = 1;
const STORE = "races";
const ACTIVE_KEY = "active-race-id";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "race.id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB failed."));
  });
}

export async function saveCompanionBundle(bundle: CompanionBundle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(bundle);
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
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(raceId);
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
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to clear data."));
  });
  db.close();
}
