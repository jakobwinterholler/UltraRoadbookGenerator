/** OAuth callback path — each app returns here after Google sign-in. */
export const OAUTH_CALLBACK_PATH = "/auth/callback";

const RETURN_PATH_KEY = "ultra:oauth-return-path";

/** Supabase redirect URL for the app that started sign-in (never hardcode production). */
export function getOAuthRedirectUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
}

/** Remember where to return after OAuth completes on this origin. */
export function storeOAuthReturnPath(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (path === OAUTH_CALLBACK_PATH || path.startsWith(`${OAUTH_CALLBACK_PATH}?`)) {
    sessionStorage.setItem(RETURN_PATH_KEY, "/");
    return;
  }
  sessionStorage.setItem(RETURN_PATH_KEY, path || "/");
}

export function peekOAuthReturnPath(): string {
  if (typeof sessionStorage === "undefined") {
    return "/";
  }
  const stored = sessionStorage.getItem(RETURN_PATH_KEY);
  return stored && stored.startsWith("/") ? stored : "/";
}

export function consumeOAuthReturnPath(): string {
  if (typeof sessionStorage === "undefined") {
    return "/";
  }
  const stored = sessionStorage.getItem(RETURN_PATH_KEY);
  sessionStorage.removeItem(RETURN_PATH_KEY);
  return stored && stored.startsWith("/") ? stored : "/";
}

export function isOAuthCallbackRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.pathname === OAUTH_CALLBACK_PATH;
}
