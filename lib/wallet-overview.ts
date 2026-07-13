import { useCallback, useEffect, useState } from "react";

import { getAccessTokenWithRetry } from "@/lib/access-token";
import { useAuth } from "@/lib/auth";
import {
  getWalletOverview,
  isBackendConfigured,
  type WalletOverviewResponse,
} from "@/lib/api";

type UseWalletOverviewResult = {
  overview: WalletOverviewResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

let cachedWalletOverview: WalletOverviewResponse | null = null;
let cachedWalletOverviewAt = 0;
const WALLET_CACHE_TTL_MS = 30_000;

// Listeners for external cache invalidation (e.g. from WebSocket wallet:updated events)
type WalletChangeListener = () => void;
const walletChangeListeners = new Set<WalletChangeListener>();

/**
 * Call this from the WS handler when a `wallet:updated` event arrives.
 * It invalidates the cache and notifies all mounted `useWalletOverview` hooks.
 */
export function invalidateWalletCache(): void {
  cachedWalletOverviewAt = 0;
  for (const listener of walletChangeListeners) {
    listener();
  }
}

export function useWalletOverview(): UseWalletOverviewResult {
  const { getAccessToken, isReady, user } = useAuth();
  const [overview, setOverview] = useState<WalletOverviewResponse | null>(
    () => cachedWalletOverview,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!isBackendConfigured() || !isReady || !user) {
      setOverview(null);
      setIsLoading(false);
      return;
    }

    // Return cached if fresh
    if (
      cachedWalletOverview &&
      Date.now() - cachedWalletOverviewAt < WALLET_CACHE_TTL_MS
    ) {
      setOverview(cachedWalletOverview);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) {
        throw new Error("Could not get an access token for wallet overview.");
      }

      const response = await getWalletOverview({ accessToken });
      cachedWalletOverview = response;
      cachedWalletOverviewAt = Date.now();
      setOverview(response);
    } catch (loadError) {
      setOverview(cachedWalletOverview);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load wallet overview.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, isReady, user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh when wallet cache is externally invalidated (e.g. WS wallet:updated)
  useEffect(() => {
    const listener = () => void load();
    walletChangeListeners.add(listener);
    return () => { walletChangeListeners.delete(listener); };
  }, [load]);

  return {
    overview,
    isLoading,
    error,
    refresh: load,
  };
}

export async function prefetchWalletOverview(
  getAccessToken: () => Promise<string | null | undefined>,
): Promise<void> {
  if (!isBackendConfigured()) return;
  if (
    cachedWalletOverview &&
    Date.now() - cachedWalletOverviewAt < WALLET_CACHE_TTL_MS
  ) {
    return;
  }

  try {
    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) return;

    const response = await getWalletOverview({ accessToken });
    cachedWalletOverview = response;
    cachedWalletOverviewAt = Date.now();
  } catch {
    // Silent — home screen will retry
  }
}
