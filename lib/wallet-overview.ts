import { usePrivy } from "@privy-io/expo";
import { useCallback, useEffect, useState } from "react";

import { getAccessTokenWithRetry } from "@/lib/access-token";
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

export function useWalletOverview(): UseWalletOverviewResult {
  const { getAccessToken, isReady, user } = usePrivy();
  const [overview, setOverview] = useState<WalletOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!isBackendConfigured() || !isReady || !user) {
      setOverview(null);
      setIsLoading(false);
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
      setOverview(response);
    } catch (loadError) {
      setOverview(null);
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

  return {
    overview,
    isLoading,
    error,
    refresh: load,
  };
}
