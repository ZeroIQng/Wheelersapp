import { useCallback, useEffect, useState } from "react";

import { getAccessTokenWithRetry } from "@/lib/access-token";
import { useAuth } from "@/lib/auth";
import {
  getWalletTransactions,
  isBackendConfigured,
  type WalletTransaction,
} from "@/lib/api";

type UseWalletTransactionsResult = {
  items: WalletTransaction[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useWalletTransactions(limit = 30): UseWalletTransactionsResult {
  const { getAccessToken, isReady, user } = useAuth();
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!isBackendConfigured() || !isReady || !user) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) {
        throw new Error("Could not get an access token for wallet transactions.");
      }

      const response = await getWalletTransactions({
        accessToken,
        limit,
      });

      setItems(response.items);
    } catch (loadError) {
      setItems([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load wallet transactions.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, isReady, limit, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    items,
    isLoading,
    error,
    refresh: load,
  };
}
