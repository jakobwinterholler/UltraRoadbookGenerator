import { getSupabaseClient } from "../auth/supabaseClient";
import type { DeviceKind } from "./deviceActivity";

export interface DeviceRecord {
  lastActive: string;
}

export type DeviceMap = Partial<Record<DeviceKind, DeviceRecord>>;

export function readDevicesFromMetadata(
  metadata: Record<string, unknown> | undefined,
): DeviceMap {
  const raw = metadata?.devices;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as DeviceMap;
}

export async function updateDeviceLastActive(kind: DeviceKind): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }
  const devices = readDevicesFromMetadata(user.user_metadata);
  devices[kind] = { lastActive: new Date().toISOString() };
  await supabase.auth.updateUser({
    data: { devices },
  });
}
