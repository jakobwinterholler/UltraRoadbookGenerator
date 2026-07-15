/** Stable checksum for companion bundle validation (mirrors src/bundle_checksum.py). */

import type { CompanionBundle } from "../types/sync";

const VOLATILE_FIELDS = new Set(["syncedAt", "bundleChecksum", "exportedAt"]);

export function canonicalBundlePayload(bundle: CompanionBundle): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bundle)) {
    if (!VOLATILE_FIELDS.has(key)) {
      payload[key] = value;
    }
  }
  return payload;
}

export async function computeBundleChecksum(bundle: CompanionBundle): Promise<string> {
  const payload = canonicalBundlePayload(bundle);
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function computeBundleChecksumSync(bundle: CompanionBundle): string | null {
  if (bundle.bundleChecksum) {
    return bundle.bundleChecksum;
  }
  return null;
}
