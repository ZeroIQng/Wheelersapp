import { Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useDriverSession } from '@/lib/driver-session';
import { stopRideRequestSound } from '@/lib/sounds';

/** Screens that move themselves when the trip changes — leave them to it. */
const SELF_ROUTING_PATHS = [
  '/driver/navigation',
  '/driver/arrived',
  '/driver/active-trip',
  '/driver/payout',
  '/driver/incoming-request',
  '/driver/pending-bid',
];

function tripScreenFor(status: string): Href | null {
  switch (status) {
    case 'navigating':
      return '/driver/navigation' as Href;
    case 'arrived':
      return '/driver/arrived' as Href;
    case 'active':
      return '/driver/active-trip' as Href;
    default:
      return null;
  }
}

/**
 * Moves the driver onto the trip screens whenever a trip starts — wherever
 * they happen to be. A match can land while they're on the History tab, the
 * wallet, or the map with the request card long closed; before this only the
 * request modal reacted, so from anywhere else the "bid sent" card simply
 * vanished and nothing followed.
 *
 * Routes once per (ride, status): coming back to the map mid-trip is allowed,
 * and the "trip in progress" card there is the way back in.
 */
export function DriverTripRouter() {
  const { session } = useDriverSession();
  const router = useRouter();
  const pathname = usePathname();
  const routedKeyRef = useRef<string | null>(null);

  const currentRide = session.currentRide;
  const status = session.status;

  // The request alert must never outlive the auction. Screens stop it on
  // their own transitions, but this is the one place that always renders —
  // so it is the backstop: a live trip or an empty request queue means quiet.
  const hasOffers = session.offers.length > 0;
  useEffect(() => {
    if (currentRide || !hasOffers) {
      void stopRideRequestSound();
    }
  }, [currentRide, hasOffers]);

  useEffect(() => {
    if (!currentRide) {
      routedKeyRef.current = null;
      return;
    }
    const target = tripScreenFor(status);
    if (!target) return;

    const key = `${currentRide.rideId}:${status}`;
    if (routedKeyRef.current === key) return;
    routedKeyRef.current = key;

    if (SELF_ROUTING_PATHS.some((prefix) => pathname.startsWith(prefix))) return;

    void stopRideRequestSound();
    router.push(target);
  }, [currentRide, status, pathname, router]);

  return null;
}
