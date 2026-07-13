const LAST_SYNC_PREFIX = "ultra:last-sync:";
const SYNCING_PREFIX = "ultra:sync-in-progress:";

export function getLastSyncAt(userId: string): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(`${LAST_SYNC_PREFIX}${userId}`);
}

export function setLastSyncAt(userId: string, iso: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(`${LAST_SYNC_PREFIX}${userId}`, iso);
}

export function isSyncInProgress(userId: string): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem(`${SYNCING_PREFIX}${userId}`) === "1";
}

export function setSyncInProgress(userId: string, active: boolean): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  const key = `${SYNCING_PREFIX}${userId}`;
  if (active) {
    localStorage.setItem(key, "1");
  } else {
    localStorage.removeItem(key);
  }
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) {
    return "Never";
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "Never";
  }
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
