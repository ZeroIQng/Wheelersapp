/**
 * The road from where the driver IS to where they are GOING — not the route
 * planned at booking time. The planned geometry often isn't available at all
 * (a trip recovered after restart carries none), and even when it is, it
 * starts at the pickup, not at the driver. This asks the backend's route
 * planner for driver → target and refreshes as the driver moves, so the map
 * always shows a line from the blue arrow to the destination.
 */
import { useEffect, useRef, useState } from 'react';

import { getRideEstimate, type RideEstimateWaypoint } from '@/lib/api';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { useAuth } from '@/lib/auth';
import { bearingDeg, haversineKm } from '@/lib/geo';

type LatLng = { latitude: number; longitude: number };

/** Refetch once the driver has moved this far from the last route origin. */
const REFRESH_DISTANCE_KM = 0.25;

export function useLiveRoute(params: {
  origin: { lat: number; lng: number } | null;
  target: RideEstimateWaypoint | null;
  enabled: boolean;
}): { coords: LatLng[] } {
  const { origin, target, enabled } = params;
  const { getAccessToken } = useAuth();
  const [coords, setCoords] = useState<LatLng[]>([]);
  const lastFetchRef = useRef<{ lat: number; lng: number; targetKey: string } | null>(null);
  const inFlightRef = useRef(false);

  const targetKey = target ? `${target.lat},${target.lng}` : '';

  useEffect(() => {
    if (!enabled || !origin || !target) return;

    const last = lastFetchRef.current;
    const moved = last
      ? haversineKm(origin.lat, origin.lng, last.lat, last.lng)
      : Number.POSITIVE_INFINITY;
    if (last && last.targetKey === targetKey && moved < REFRESH_DISTANCE_KM) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    void (async () => {
      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) return;
        const estimate = await getRideEstimate({
          accessToken,
          pickup: { lat: origin.lat, lng: origin.lng, address: 'Current location' },
          destination: target,
        });
        const line = estimate.route?.coordinates;
        if (line && line.length > 1) {
          setCoords(line.map((point) => ({ latitude: point.lat, longitude: point.lng })));
          lastFetchRef.current = { lat: origin.lat, lng: origin.lng, targetKey };
        }
      } catch {
        // Keep whatever line we had; a straight fallback is drawn by callers.
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [enabled, origin, target, targetKey, getAccessToken]);

  return { coords };
}

/**
 * Which way the arrow points: the direction of actual travel once the driver
 * has moved a meaningful distance, otherwise the direction of the target —
 * so a parked car still points where the driver should head.
 */
export function useCourseBearing(
  current: { lat: number; lng: number } | null,
  target: { lat: number; lng: number } | null,
): number {
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);
  const bearingRef = useRef(0);

  if (current) {
    const prev = prevRef.current;
    if (prev && haversineKm(prev.lat, prev.lng, current.lat, current.lng) > 0.015) {
      bearingRef.current = bearingDeg(prev.lat, prev.lng, current.lat, current.lng);
      prevRef.current = current;
    } else if (!prev) {
      prevRef.current = current;
      if (target) bearingRef.current = bearingDeg(current.lat, current.lng, target.lat, target.lng);
    } else if (target && bearingRef.current === 0) {
      bearingRef.current = bearingDeg(current.lat, current.lng, target.lat, target.lng);
    }
  }

  return bearingRef.current;
}
