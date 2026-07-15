/** Injected at build time from package.json via Vite `define`. */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

export function formatAppVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

export interface VersionManifest {
  version: string;
  builtAt: string;
}

/** Fetch the version currently deployed on the server (bypasses caches). */
export async function fetchDeployedVersionManifest(): Promise<VersionManifest | null> {
  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as Partial<VersionManifest>;
    if (typeof payload.version !== "string") {
      return null;
    }
    return {
      version: payload.version,
      builtAt: typeof payload.builtAt === "string" ? payload.builtAt : "",
    };
  } catch {
    return null;
  }
}
