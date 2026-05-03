import { usePrivy } from "@privy-io/expo";
import { useEffect, useState } from "react";

import { getAccessTokenWithRetry } from "@/lib/access-token";
import {
  getRiderRideHistory,
  isBackendConfigured,
  type RiderHistoryRide,
} from "@/lib/api";

export type RiderHistoryListItem = {
  id: string;
  title: string;
  meta: string;
  fare: string;
  statusLabel: string;
  icon: string;
};

type UseRiderHistoryResult = {
  items: RiderHistoryListItem[];
  isLoading: boolean;
  error: string | null;
};

function shortenAddress(value: string): string {
  const [firstSegment] = value.split(",");
  const trimmed = firstSegment?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : value;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent ride";
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / (24 * 60 * 60 * 1000),
  );

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (dayDiff === 0) {
    return `Today, ${time}`;
  }

  if (dayDiff === 1) {
    return `Yesterday, ${time}`;
  }

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  return `${dayLabel}, ${time}`;
}

function formatFare(ride: RiderHistoryRide): string {
  const fare = ride.fareFinalUsdt ?? ride.fareEstimateUsdt;
  return typeof fare === "number" ? `${fare.toFixed(2)} USDT` : "Fare pending";
}

function mapIcon(ride: RiderHistoryRide): string {
  if (ride.status === "CANCELLED") {
    return "event-busy";
  }

  return "history";
}

function mapStatusLabel(ride: RiderHistoryRide): string {
  if (ride.status === "CANCELLED") {
    return "Cancelled";
  }

  return "Completed";
}

function mapRideItem(ride: RiderHistoryRide): RiderHistoryListItem {
  return {
    id: ride.id,
    title: `${shortenAddress(ride.pickupAddress)} to ${shortenAddress(ride.destAddress)}`,
    meta: formatWhen(ride.completedAt ?? ride.cancelledAt ?? ride.createdAt),
    fare: formatFare(ride),
    statusLabel: mapStatusLabel(ride),
    icon: mapIcon(ride),
  };
}

export function useRiderHistory(limit = 20): UseRiderHistoryResult {
  const { getAccessToken, isReady, user } = usePrivy();
  const [items, setItems] = useState<RiderHistoryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!isBackendConfigured() || !isReady || !user) {
        if (!cancelled) {
          setItems([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) {
          throw new Error("Could not get an access token for ride history.");
        }

        const response = await getRiderRideHistory({
          accessToken,
          limit,
        });

        if (!cancelled) {
          setItems(response.items.map(mapRideItem));
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load ride history.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isReady, limit, user]);

  return {
    items,
    isLoading,
    error,
  };
}
