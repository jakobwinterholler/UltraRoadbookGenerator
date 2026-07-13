export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "";
}

export async function fetchWithAuth(
  path: string,
  accessToken: string | null,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, headers });
}

export async function parseApiError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({ detail: fallback }));
  const detail = payload.detail;
  return typeof detail === "string" ? detail : fallback;
}
