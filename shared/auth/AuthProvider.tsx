import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  getAccessToken,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./supabaseClient";
import {
  clearOAuthCallbackParams,
  clearSigningIn,
  isOAuthCallbackInProgress,
  isSigningInMarked,
  markSigningIn,
  readOAuthCallbackError,
} from "./oauthCallback";

interface AuthContextValue {
  configured: boolean;
  /** True while the initial session is being restored from storage. */
  isRestoring: boolean;
  /** True during OAuth redirect / callback handling. */
  signingIn: boolean;
  /** @deprecated Use isRestoring */
  loading: boolean;
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [isRestoring, setIsRestoring] = useState(configured);
  const [signingIn, setSigningIn] = useState(
    () => configured && (isOAuthCallbackInProgress() || isSigningInMarked()),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(() => readOAuthCallbackError());

  useEffect(() => {
    const callbackError = readOAuthCallbackError();
    if (callbackError) {
      setAuthError(callbackError);
      clearOAuthCallbackParams();
      clearSigningIn();
      setSigningIn(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setIsRestoring(false);
      return;
    }

    function clearAbandonedSignIn(hasSession: boolean) {
      if (!hasSession && !isOAuthCallbackInProgress()) {
        clearSigningIn();
        setSigningIn(false);
      }
    }

    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSession(data.session);
      setIsRestoring(false);
      if (data.session) {
        clearSigningIn();
        setSigningIn(false);
      } else {
        clearAbandonedSignIn(false);
      }
    });

    const onFocus = () => {
      void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
        if (!data.session && !isOAuthCallbackInProgress()) {
          clearSigningIn();
          setSigningIn(false);
        }
      });
    };
    window.addEventListener("focus", onFocus);

    const abandonTimeout = window.setTimeout(() => {
      if (!session && !isOAuthCallbackInProgress()) {
        clearSigningIn();
        setSigningIn(false);
      }
    }, 90_000);

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, nextSession: Session | null) => {
        setSession(nextSession);
        setIsRestoring(false);
        if (nextSession) {
          setAuthError(null);
          clearSigningIn();
          setSigningIn(false);
        }
        if (
          event === "SIGNED_IN" &&
          (window.location.hash || window.location.search.includes("code="))
        ) {
          clearOAuthCallbackParams();
        }
        if (event === "SIGNED_OUT") {
          clearSigningIn();
          setSigningIn(false);
        }
      },
    );

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearTimeout(abandonTimeout);
      subscription.subscription.unsubscribe();
    };
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    markSigningIn();
    setSigningIn(true);
    const supabase = getSupabaseClient();
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      clearSigningIn();
      setSigningIn(false);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      isRestoring,
      signingIn,
      loading: isRestoring,
      session,
      user: session?.user ?? null,
      accessToken: getAccessToken(session),
      authError,
      signInWithGoogle,
      signOut,
    }),
    [configured, isRestoring, signingIn, session, authError, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
