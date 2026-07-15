import { useEffect, useState, type ReactNode } from "react";
import { SigningInScreen } from "../ui/AuthScreens";
import { useAuth } from "./AuthProvider";
import {
  clearOAuthCallbackParams,
  isOAuthCallbackInProgress,
} from "./oauthCallback";
import {
  consumeOAuthReturnPath,
  isOAuthCallbackRoute,
} from "./oauthRedirect";

interface AuthCallbackRouterProps {
  children: ReactNode;
  variant?: "light" | "dark";
}

/**
 * Handles /auth/callback on each app origin, then returns to the page that started sign-in.
 */
export function AuthCallbackRouter({
  children,
  variant = "light",
}: AuthCallbackRouterProps) {
  const { session, isRestoring, signingIn, authError } = useAuth();
  const onCallback = isOAuthCallbackRoute();
  const [returned, setReturned] = useState(() => !onCallback);

  useEffect(() => {
    if (!onCallback || returned) {
      return;
    }
    if (isRestoring) {
      return;
    }
    if (!session && !authError && (signingIn || isOAuthCallbackInProgress())) {
      return;
    }

    const returnPath = consumeOAuthReturnPath();
    clearOAuthCallbackParams();
    window.history.replaceState(null, "", returnPath);
    setReturned(true);
  }, [authError, isRestoring, onCallback, returned, session, signingIn]);

  if (onCallback && !returned) {
    return (
      <SigningInScreen
        variant={variant}
        message={authError ? "Sign in failed" : "Completing sign in…"}
      />
    );
  }

  return <>{children}</>;
}
