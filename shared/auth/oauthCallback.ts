/** Parse OAuth error returned in URL after failed redirect. */
export function readOAuthCallbackError(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    search.get("error_description") ??
    search.get("error") ??
    hash.get("error_description") ??
    hash.get("error")
  );
}

export function clearOAuthCallbackParams(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!window.location.search && !window.location.hash) {
    return;
  }
  window.history.replaceState(null, "", window.location.pathname);
}

/** Detect an in-progress OAuth redirect callback in the current URL. */
export function isOAuthCallbackInProgress(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const search = window.location.search;
  const hash = window.location.hash;
  return (
    search.includes("code=") ||
    hash.includes("access_token=") ||
    hash.includes("error=") ||
    search.includes("error=")
  );
}

const SIGNING_IN_KEY = "ultra:signing-in";

export function markSigningIn(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SIGNING_IN_KEY, "1");
  }
}

export function clearSigningIn(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SIGNING_IN_KEY);
  }
}

export function isSigningInMarked(): boolean {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  return sessionStorage.getItem(SIGNING_IN_KEY) === "1";
}
