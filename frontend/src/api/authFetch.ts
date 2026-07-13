import { fetchWithAuth } from "@shared/api/client";

let accessToken: string | null = null;

export function setAuthAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAuthAccessToken(): string | null {
  return accessToken;
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(path, accessToken, init);
}
