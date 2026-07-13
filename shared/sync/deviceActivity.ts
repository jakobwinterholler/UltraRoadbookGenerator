export type DeviceKind = "desktop" | "companion";

const KEY = "ultra:device-activity";

interface DeviceActivity {
  desktop?: string;
  companion?: string;
}

function read(): DeviceActivity {
  if (typeof localStorage === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeviceActivity) : {};
  } catch {
    return {};
  }
}

function write(data: DeviceActivity): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function recordDeviceActivity(kind: DeviceKind): void {
  const data = read();
  data[kind] = new Date().toISOString();
  write(data);
}

export function getDeviceActivity(): DeviceActivity {
  return read();
}

export function formatDeviceLastActive(iso: string | undefined): string {
  if (!iso) {
    return "Not seen yet";
  }
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return "Not seen yet";
  }
  return then.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
