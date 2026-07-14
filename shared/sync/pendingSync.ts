const PREFIX = "ultra:pending-sync:";

function storageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

function readSet(userId: string): Set<string> {
  if (typeof localStorage === "undefined" || !userId) {
    return new Set();
  }
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(userId: string, ids: Set<string>): void {
  if (typeof localStorage === "undefined" || !userId) {
    return;
  }
  if (ids.size === 0) {
    localStorage.removeItem(storageKey(userId));
    return;
  }
  localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
}

export function getPendingSyncRaces(userId: string): Set<string> {
  return readSet(userId);
}

export function addPendingSyncRace(userId: string, raceId: string): void {
  if (!userId || !raceId) {
    return;
  }
  const ids = readSet(userId);
  ids.add(raceId);
  writeSet(userId, ids);
}

export function removePendingSyncRace(userId: string, raceId: string): void {
  if (!userId || !raceId) {
    return;
  }
  const ids = readSet(userId);
  ids.delete(raceId);
  writeSet(userId, ids);
}

export function clearPendingSyncRaces(userId: string): void {
  if (typeof localStorage === "undefined" || !userId) {
    return;
  }
  localStorage.removeItem(storageKey(userId));
}

export function isPendingSyncRace(userId: string, raceId: string): boolean {
  return readSet(userId).has(raceId);
}

export function hasPendingSyncRaces(userId: string): boolean {
  return readSet(userId).size > 0;
}
