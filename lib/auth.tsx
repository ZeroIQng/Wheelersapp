import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  clearStoredLocalAccessToken,
  getStoredLocalAccessToken,
  type AccessTokenGetter,
} from "@/lib/access-token";
import { clearStoredAuthState } from "@/lib/auth-state";

interface AuthContextValue {
  /** Returns the locally stored access token, or null. */
  getAccessToken: AccessTokenGetter;
  /** True once the initial token check has completed. */
  isReady: boolean;
  /** Non-null when there is a stored access token (lightweight sentinel). */
  user: { authenticated: true } | null;
  /** Clears the local token and auth state. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await getStoredLocalAccessToken();
      if (!cancelled) {
        setHasToken(Boolean(token));
        setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const getAccessToken: AccessTokenGetter = useCallback(async () => {
    return getStoredLocalAccessToken();
  }, []);

  const logout = useCallback(async () => {
    await clearStoredLocalAccessToken();
    await clearStoredAuthState();
    setHasToken(false);
  }, []);

  const user = useMemo(
    () => (hasToken ? { authenticated: true as const } : null),
    [hasToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ getAccessToken, isReady, user, logout }),
    [getAccessToken, isReady, user, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
