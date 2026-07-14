import { formatDeviceLastActive } from "@shared/sync/deviceActivity";
import type { DeviceMap } from "@shared/sync/deviceProfile";

const CONNECTED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function isDeviceRecentlyActive(lastActive: string | undefined): boolean {
  if (!lastActive) {
    return false;
  }
  const then = new Date(lastActive).getTime();
  if (Number.isNaN(then)) {
    return false;
  }
  return Date.now() - then < CONNECTED_WINDOW_MS;
}

export function companionConnectionLabel(devices: DeviceMap): string {
  const lastActive = devices.companion?.lastActive;
  if (isDeviceRecentlyActive(lastActive)) {
    return "Yes";
  }
  if (lastActive) {
    return `Last seen ${formatDeviceLastActive(lastActive)}`;
  }
  return "Not yet";
}

export function desktopConnectionLabel(devices: DeviceMap): string {
  const lastActive = devices.desktop?.lastActive;
  if (isDeviceRecentlyActive(lastActive)) {
    return "Yes";
  }
  if (lastActive) {
    return `Last seen ${formatDeviceLastActive(lastActive)}`;
  }
  return "Not yet";
}
