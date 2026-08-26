import * as Crypto from 'expo-crypto';
import { useAuth } from '@/lib/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  getBackendWebSocketUrl,
  isBackendConfigured,
  type RideEstimateWaypoint,
  type RideRouteGeometry,
} from '@/lib/api';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { estimateEtaSeconds, haversineKm } from '@/lib/geo';
import { invalidateWalletCache } from '@/lib/wallet-overview';

type DriverConnectionState = 'disconnected' | 'connecting' | 'connected';

type DriverStatus =
  | 'offline'
  | 'online'
  | 'offered'
  | 'navigating'
  | 'arrived'
  | 'active'
  | 'completed';

type RideOffer = {
  rideId: string;
  riderId: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops: RideEstimateWaypoint[];
  fareEstimateNgn: number;
  /**
   * What the rider is actually offering right now. A rider counter-offer only
   * moves this field — fareEstimateNgn stays at the original estimate — so a
   * screen that reads fareEstimateNgn shows a stale price forever.
   */
  riderOfferNgn?: number;
  plannedDistanceKm?: number;
  plannedDurationSeconds?: number;
  /**
   * Driver→pickup at match time, from the backend. A seed for the live
   * "to pickup" card — screens recompute from the phone's own GPS when a fix
   * is available.
   */
  pickupDistanceKm?: number;
  pickupEtaSeconds?: number;
  expiresAt: string;
  route?: RideRouteGeometry;
  /** Shared ride: several riders picked up and dropped along one route. */
  isGroupRide?: boolean;
  riderCount?: number;
  /** Parallel to `stops` — which waypoints are pickups vs drop-offs. */
  stopKinds?: Array<'pickup' | 'dropoff'>;
  /**
   * Group rides: each rider's own leg and seat offer. The driver negotiates
   * per seat — accept one rider's price, bid another — not on a lump sum.
   */
  groupMembers?: GroupSeat[];
};

export type GroupSeat = {
  rideId: string;
  riderId: string;
  pickup: RideEstimateWaypoint;
  dropoff: RideEstimateWaypoint;
  offerNgn: number;
};

type DriverRide = {
  rideId: string;
  riderId: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops: RideEstimateWaypoint[];
  fareNgn: number;
  plannedDistanceKm?: number;
  plannedDurationSeconds?: number;
  route?: RideRouteGeometry;
  startedAt?: string;
  completedAt?: string;
  completedFareNgn?: number;
  distanceKm?: number;
  durationSeconds?: number;
  riderPaid?: boolean;
  riderPhone?: string;
  liveDistanceKm?: number;
};

export type ChatMessage = {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: 'RIDER' | 'DRIVER';
  content: string;
  createdAt: string;
};

/**
 * A bid the driver has sent, waiting on the rider. Snapshotted from the offer
 * at bid time because the offer card expires after 30s while the rider has
 * minutes to decide — by the time ride:matched arrives, the offer is usually
 * gone from the queue, and the match used to be silently dropped.
 */
export type PendingBid = {
  offer: RideOffer;
  amountNgn: number;
  sentAt: string;
};

export type DriverSessionState = {
  status: DriverStatus;
  /**
   * Every live request, newest first. Offers used to be a single slot, so a
   * second request silently overwrote the first and the driver never knew it
   * existed — they only ever saw whichever one arrived last.
   */
  offers: RideOffer[];
  /** The offer currently open on screen. */
  currentOffer: RideOffer | null;
  currentRide: DriverRide | null;
  /** Bids sent and not yet answered, keyed by rideId. */
  pendingBids: Record<string, PendingBid>;
};

type DriverSessionContextValue = {
  isConfigured: boolean;
  connectionState: DriverConnectionState;
  session: DriverSessionState;
  chatMessages: ChatMessage[];
  error: string | null;
  goOnline: (lat: number, lng: number) => Promise<void>;
  goOffline: () => Promise<void>;
  acceptRide: (
    rideId: string,
    counterOfferNgn?: number,
    origin?: { lat: number; lng: number },
  ) => Promise<void>;
  bidOnSeat: (
    seat: GroupSeat,
    amountNgn?: number,
    origin?: { lat: number; lng: number },
  ) => Promise<void>;
  rejectRide: (rideId: string) => Promise<void>;
  /** Open one of the queued requests. */
  selectOffer: (rideId: string) => void;
  /** Close the open request without rejecting it — it stays in the queue. */
  closeOffer: () => void;
  arriveAtPickup: (rideId: string) => Promise<void>;
  startTrip: (rideId: string) => Promise<void>;
  endTrip: (rideId: string) => Promise<void>;
  sendGps: (lat: number, lng: number) => void;
  sendChatMessage: (rideId: string, content: string) => Promise<void>;
  clearCompleted: () => void;
};

type GatewayMessage = {
  type?: string;
  payload?: Record<string, unknown>;
};

const reconnectDelayMs = 1500;

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseWaypoint(value: unknown): RideEstimateWaypoint | null {
  const record = getRecord(value);
  if (!record) return null;
  const lat = getNumber(record.lat);
  const lng = getNumber(record.lng);
  const address = getString(record.address);
  if (lat === undefined || lng === undefined || !address) return null;
  return { lat, lng, address };
}

function parseWaypointList(value: unknown): RideEstimateWaypoint[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseWaypoint).filter((w): w is RideEstimateWaypoint => w !== null);
}

const defaultSession: DriverSessionState = {
  status: 'offline',
  offers: [],
  currentOffer: null,
  currentRide: null,
  pendingBids: {},
};

/** Drops requests whose bid window has already closed. */
function pruneExpiredOffers(offers: RideOffer[]): RideOffer[] {
  const now = Date.now();
  return offers.filter((offer) => {
    const expiresMs = new Date(offer.expiresAt).getTime();
    return !Number.isFinite(expiresMs) || expiresMs > now;
  });
}

const defaultContext: DriverSessionContextValue = {
  isConfigured: false,
  connectionState: 'disconnected',
  session: defaultSession,
  chatMessages: [],
  error: null,
  goOnline: async (_lat: number, _lng: number) => { throw new Error('Driver session unavailable.'); },
  goOffline: async () => { throw new Error('Driver session unavailable.'); },
  acceptRide: async (_rideId: string, _counterOfferNgn?: number) => { throw new Error('Driver session unavailable.'); },
  bidOnSeat: async () => { throw new Error('Driver session unavailable.'); },
  selectOffer: (_rideId: string) => {},
  closeOffer: () => {},
  rejectRide: async () => { throw new Error('Driver session unavailable.'); },
  arriveAtPickup: async () => { throw new Error('Driver session unavailable.'); },
  startTrip: async () => { throw new Error('Driver session unavailable.'); },
  endTrip: async () => { throw new Error('Driver session unavailable.'); },
  sendGps: () => undefined,
  sendChatMessage: async () => { throw new Error('Driver session unavailable.'); },
  clearCompleted: () => undefined,
};

const DriverSessionContext = createContext<DriverSessionContextValue>(defaultContext);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function DriverSessionProvider({ children }: { children: ReactNode }) {
  const { user, isReady, getAccessToken } = useAuth();

  const [connectionState, setConnectionState] = useState<DriverConnectionState>('disconnected');
  const [session, setSession] = useState<DriverSessionState>(defaultSession);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const connectPromiseRef = useRef<Promise<WebSocket> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldMaintainConnectionRef = useRef(false);
  const lastOnlineCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const userRef = useRef(user);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const handleGatewayMessage = useCallback(
    (message: GatewayMessage) => {
      const { type, payload } = message;
      if (!type || !payload) return;

      if (type === 'error') {
        setError(getString(payload.message) ?? 'Driver session error.');
        return;
      }

      if (type === 'ride:offer') {
        const pickup = parseWaypoint(payload.pickup);
        const destination = parseWaypoint(payload.destination);
        if (!pickup || !destination) return;

        setSession((prev) => {
          const incoming: RideOffer = {
            rideId: getString(payload.rideId) ?? '',
            riderId: getString(payload.riderId) ?? '',
            pickup,
            destination,
            stops: parseWaypointList(payload.stops),
            fareEstimateNgn: getNumber(payload.fareEstimateNgn) ?? 0,
            riderOfferNgn: getNumber(payload.riderOfferNgn),
            plannedDistanceKm: getNumber(payload.plannedDistanceKm),
            plannedDurationSeconds: getNumber(payload.plannedDurationSeconds),
            pickupDistanceKm: getNumber(payload.pickupDistanceKm),
            pickupEtaSeconds: getNumber(payload.pickupEtaSeconds),
            expiresAt: getString(payload.expiresAt) ?? '',
            route: payload.route as RideRouteGeometry | undefined,
            isGroupRide: payload.isGroupRide === true,
            riderCount: getNumber(payload.riderCount),
            stopKinds: Array.isArray(payload.stopKinds)
              ? (payload.stopKinds.filter(
                  (k): k is 'pickup' | 'dropoff' => k === 'pickup' || k === 'dropoff',
                ))
              : undefined,
            groupMembers: Array.isArray(payload.groupMembers) && payload.groupMembers.length > 0
              ? (payload.groupMembers as GroupSeat[])
              : undefined,
          };

          // Same rideId means a re-priced version of a request already in the
          // queue, so it replaces that entry rather than adding a duplicate.
          const others = pruneExpiredOffers(prev.offers).filter(
            (queued) => queued.rideId !== incoming.rideId,
          );
          const offers = [incoming, ...others];

          // Don't yank the driver off a request they're reading. Only take
          // over the screen when nothing is open, or when this update is for
          // the very request they're looking at.
          const keepsCurrent =
            prev.currentOffer !== null && prev.currentOffer.rideId !== incoming.rideId;

          return {
            ...prev,
            status: prev.currentRide ? prev.status : 'offered',
            offers,
            currentOffer: keepsCurrent ? prev.currentOffer : incoming,
          };
        });
        return;
      }

      if (type === 'driver:accept:accepted') {
        // Bid sent — stay on the offer screen, wait for rider to accept
        setSession((prev) => ({
          ...prev,
          status: 'offered',
        }));
        return;
      }

      if (type === 'ride:matched') {
        // Rider accepted — now navigate to pickup
        setSession((prev) => {
          const matchedRideId = getString(payload.rideId);
          const offer =
            (matchedRideId
              ? (prev.currentOffer?.rideId === matchedRideId ? prev.currentOffer : undefined) ??
                prev.offers.find((queued) => queued.rideId === matchedRideId) ??
                prev.pendingBids[matchedRideId]?.offer
              : prev.currentOffer) ?? null;

          if (!offer) {
            // Backend has assigned this ride to us but we can no longer
            // reconstruct it (e.g. app restarted mid-bid). Say so instead of
            // pretending nothing happened.
            console.warn('[driver-session] ride:matched for unknown ride', matchedRideId);
            return prev;
          }

          return {
            ...prev,
            status: 'navigating',
            // Taking this ride drops every other request — the driver is busy.
            offers: [],
            currentOffer: null,
            pendingBids: {},
            currentRide: {
              rideId: offer.rideId,
              riderId: offer.riderId,
              pickup: offer.pickup,
              destination: offer.destination,
              stops: offer.stops,
              fareNgn: getNumber(payload.agreedFareNgn) ?? offer.fareEstimateNgn,
              plannedDistanceKm: offer.plannedDistanceKm,
              plannedDurationSeconds: offer.plannedDurationSeconds,
              route: offer.route,
              riderPaid: payload.riderPaid === true,
              riderPhone: getString(payload.riderPhone),
            },
          };
        });
        return;
      }

      if (type === 'driver:reject:accepted') {
        setSession((prev) => {
          const rejectedRideId = getString(payload.rideId) ?? prev.currentOffer?.rideId;
          const offers = pruneExpiredOffers(prev.offers).filter(
            (queued) => queued.rideId !== rejectedRideId,
          );

          // Rejecting one request should surface the next one waiting, not
          // dump the driver back to an empty home screen.
          return {
            ...prev,
            status: prev.currentRide ? prev.status : offers.length > 0 ? 'offered' : 'online',
            offers,
            currentOffer: offers[0] ?? null,
          };
        });
        return;
      }

      if (type === 'ride:arrived:ack') {
        setSession((prev) => ({
          ...prev,
          status: 'arrived',
        }));
        return;
      }

      if (type === 'ride:start:accepted' || type === 'ride:started') {
        setSession((prev) => ({
          ...prev,
          status: 'active',
          currentRide: prev.currentRide
            ? { ...prev.currentRide, startedAt: getString(payload.startedAt) ?? new Date().toISOString() }
            : prev.currentRide,
        }));
        return;
      }

      if (type === 'ride:end:accepted' || type === 'ride:completed') {
        setSession((prev) => ({
          ...prev,
          status: 'completed',
          currentRide: prev.currentRide
            ? {
                ...prev.currentRide,
                completedAt: getString(payload.completedAt) ?? new Date().toISOString(),
                completedFareNgn: getNumber(payload.fareNgn) ?? prev.currentRide.fareNgn,
                distanceKm: getNumber(payload.distanceKm),
                durationSeconds: getNumber(payload.durationSeconds),
              }
            : prev.currentRide,
        }));
        return;
      }

      if (type === 'ride:cancelled') {
        setSession((prev) => {
          const cancelledRideId = getString(payload.rideId);
          // Only the cancelled ride leaves the queue; other live requests stay.
          const offers = pruneExpiredOffers(prev.offers).filter(
            (queued) => queued.rideId !== cancelledRideId,
          );
          const cancelledCurrentRide =
            !cancelledRideId || prev.currentRide?.rideId === cancelledRideId;

          const pendingBids = { ...prev.pendingBids };
          if (cancelledRideId) delete pendingBids[cancelledRideId];

          return {
            ...prev,
            status: offers.length > 0 ? 'offered' : 'online',
            offers,
            currentOffer:
              prev.currentOffer && prev.currentOffer.rideId !== cancelledRideId
                ? prev.currentOffer
                : offers[0] ?? null,
            currentRide: cancelledCurrentRide ? null : prev.currentRide,
            pendingBids,
          };
        });
        setError('Ride was cancelled.');
        return;
      }

      if (type === 'ride:gps_update') {
        setSession((prev) => {
          if (!prev.currentRide) return prev;
          return {
            ...prev,
            currentRide: {
              ...prev.currentRide,
              liveDistanceKm: getNumber(payload.totalDistanceKm) ?? prev.currentRide.liveDistanceKm,
            },
          };
        });
        return;
      }

      if (type === 'ride:route:updated') {
        setSession((prev) => {
          if (!prev.currentRide) return prev;
          const destination = parseWaypoint(payload.destination);
          return {
            ...prev,
            currentRide: {
              ...prev.currentRide,
              destination: destination ?? prev.currentRide.destination,
              stops: parseWaypointList(payload.stops) ?? prev.currentRide.stops,
              plannedDistanceKm: getNumber(payload.plannedDistanceKm) ?? prev.currentRide.plannedDistanceKm,
              plannedDurationSeconds: getNumber(payload.plannedDurationSeconds) ?? prev.currentRide.plannedDurationSeconds,
              route: (payload.route as RideRouteGeometry | undefined) ?? prev.currentRide.route,
            },
          };
        });
        return;
      }

      if (type === 'chat:message') {
        const messageId = getString(payload.messageId);
        const rideId = getString(payload.rideId);
        const senderId = getString(payload.senderId);
        const senderRole = getString(payload.senderRole) as 'RIDER' | 'DRIVER' | undefined;
        const content = getString(payload.content);
        const createdAt = getString(payload.createdAt);
        if (!messageId || !rideId || !senderId || !senderRole || !content) return;

        const msg: ChatMessage = {
          id: messageId,
          rideId,
          senderId,
          senderRole,
          content,
          createdAt: createdAt ?? new Date().toISOString(),
        };
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        return;
      }

      if (type === 'wallet:updated') {
        invalidateWalletCache();
        return;
      }
    },
    [],
  );

  const scheduleReconnect = useCallback(() => {
    if (!shouldMaintainConnectionRef.current || !userRef.current || reconnectTimerRef.current) {
      return;
    }
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!shouldMaintainConnectionRef.current || !userRef.current) return;
      void connect().catch(() => undefined);
    }, reconnectDelayMs);
  }, []);

  const connect = useCallback(async (): Promise<WebSocket> => {
    if (!isBackendConfigured() || !isReady || !user) {
      throw new Error('Not configured or not signed in.');
    }

    const existingSocket = socketRef.current;
    if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
      return existingSocket;
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    const wsBaseUrl = getBackendWebSocketUrl();
    if (!wsBaseUrl) {
      throw new Error('Wheelers is not available right now. Please try again later.');
    }

    setConnectionState('connecting');
    clearReconnectTimer();

    connectPromiseRef.current = (async () => {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) {
        throw new Error('Could not get access token.');
      }

      const wsUrl = `${wsBaseUrl}?token=${encodeURIComponent(accessToken)}`;
      const socket = new WebSocket(wsUrl);

      return new Promise<WebSocket>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error('WebSocket connection timed out.'));
        }, 10_000);

        socket.onopen = () => {
          clearTimeout(timeout);
          socketRef.current = socket;
          connectPromiseRef.current = null;
          setConnectionState('connected');
          setError(null);
          // A reconnect while the driver believes they're online must
          // re-announce — the backend re-sends any ride requests that opened
          // (or were missed) during the connection gap. Without this, a
          // network blip silently cost the driver every request in flight.
          const lastOnline = lastOnlineCoordsRef.current;
          if (shouldMaintainConnectionRef.current && lastOnline && sessionRef.current.status !== 'offline') {
            socket.send(JSON.stringify({ type: 'driver:online', payload: lastOnline }));
          }
          resolve(socket);
        };

        socket.onmessage = (event) => {
          try {
            const parsed = JSON.parse(String(event.data)) as GatewayMessage;
            handleGatewayMessage(parsed);
          } catch {
            // ignore
          }
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          connectPromiseRef.current = null;
          setConnectionState('disconnected');
          scheduleReconnect();
          reject(new Error('WebSocket connection error.'));
        };

        socket.onclose = () => {
          clearTimeout(timeout);
          socketRef.current = null;
          connectPromiseRef.current = null;
          setConnectionState('disconnected');
          scheduleReconnect();
        };
      });
    })();

    try {
      return await connectPromiseRef.current;
    } catch (err) {
      connectPromiseRef.current = null;
      setConnectionState('disconnected');
      scheduleReconnect();
      throw err;
    }
  }, [clearReconnectTimer, getAccessToken, handleGatewayMessage, isReady, scheduleReconnect, user]);

  const sendEnvelope = useCallback(
    async (type: string, payload: Record<string, unknown>): Promise<void> => {
      const socket = await connect();
      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error('Driver session is not connected.');
      }
      socket.send(JSON.stringify({ type, payload }));
    },
    [connect],
  );

  const goOnline = useCallback(async (lat: number, lng: number) => {
    console.log('[driver-session] goOnline called with', { lat, lng });
    shouldMaintainConnectionRef.current = true;
    lastOnlineCoordsRef.current = { lat, lng };
    try {
      await connect();
      console.log('[driver-session] connected, sending driver:online');
      await sendEnvelope('driver:online', { lat, lng });
      console.log('[driver-session] driver:online sent');
      setSession((prev) => ({ ...prev, status: 'online' }));
      setError(null);
    } catch (err) {
      console.log('[driver-session] connection failed, will retry', err instanceof Error ? err.message : String(err));
      scheduleReconnect();
    }
  }, [connect, sendEnvelope, scheduleReconnect]);

  const goOffline = useCallback(async () => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'driver:offline', payload: { reason: 'manual' } }));
    }
    shouldMaintainConnectionRef.current = false;
    lastOnlineCoordsRef.current = null;
    clearReconnectTimer();
    socketRef.current = null;
    if (socket) socket.close();
    connectPromiseRef.current = null;
    setConnectionState('disconnected');
    setSession(defaultSession);
    setError(null);
  }, [clearReconnectTimer]);

  const acceptRide = useCallback(
    async (rideId: string, counterOfferNgn?: number, origin?: { lat: number; lng: number }) => {
      const offer = sessionRef.current.currentOffer;
      if (!offer || offer.rideId !== rideId) {
        throw new Error('No matching ride offer to accept.');
      }

      const amountNgn = counterOfferNgn ?? offer.riderOfferNgn ?? offer.fareEstimateNgn;

      // Real ETA from live GPS (or the backend's match-time seed) — the
      // server recomputes from its own copy too, but never send the old
      // hardcoded 300 that told every rider "5 min away".
      const pickupKm = origin
        ? haversineKm(origin.lat, origin.lng, offer.pickup.lat, offer.pickup.lng)
        : offer.pickupDistanceKm;
      const etaSeconds =
        pickupKm !== undefined ? estimateEtaSeconds(pickupKm) : offer.pickupEtaSeconds ?? 300;

      await sendEnvelope('driver:accept', {
        rideId,
        riderId: offer.riderId,
        driverName: 'Driver',
        driverRating: 5.0,
        vehiclePlate: 'N/A',
        vehicleModel: 'N/A',
        etaSeconds,
        agreedFareNgn: amountNgn,
      });

      // Remember the bid past the offer card's 30s life — the rider has
      // minutes to answer, and ride:matched must survive that gap.
      setSession((prev) => ({
        ...prev,
        pendingBids: {
          ...prev.pendingBids,
          [rideId]: { offer, amountNgn, sentAt: new Date().toISOString() },
        },
      }));
    },
    [sendEnvelope],
  );

  /**
   * Bid on ONE seat of a group ride. Reuses the driver:accept envelope with
   * the member's own ride id — the backend routes it to that rider alone.
   */
  const bidOnSeat = useCallback(
    async (seat: GroupSeat, amountNgn?: number, origin?: { lat: number; lng: number }) => {
      const finalAmount = amountNgn ?? seat.offerNgn;
      const pickupKm = origin
        ? haversineKm(origin.lat, origin.lng, seat.pickup.lat, seat.pickup.lng)
        : undefined;
      const etaSeconds = pickupKm !== undefined ? estimateEtaSeconds(pickupKm) : 300;

      await sendEnvelope('driver:accept', {
        rideId: seat.rideId,
        riderId: seat.riderId,
        driverName: 'Driver',
        driverRating: 5.0,
        vehiclePlate: 'N/A',
        vehicleModel: 'N/A',
        etaSeconds,
        agreedFareNgn: finalAmount,
      });
    },
    [sendEnvelope],
  );

  const rejectRide = useCallback(
    async (rideId: string) => {
      await sendEnvelope('driver:reject', {
        rideId,
        riderId: sessionRef.current.currentOffer?.riderId ?? '',
        reason: 'manual_reject',
      });
    },
    [sendEnvelope],
  );

  const arriveAtPickup = useCallback(
    async (rideId: string) => {
      await sendEnvelope('ride:arrived', { rideId });
      setSession((prev) => ({ ...prev, status: 'arrived' }));
    },
    [sendEnvelope],
  );

  const startTrip = useCallback(
    async (rideId: string) => {
      const ride = sessionRef.current.currentRide;
      await sendEnvelope('ride:start', {
        rideId,
        riderId: ride?.riderId ?? '',
        lockedFareNgn: ride?.fareNgn ?? 0,
      });
    },
    [sendEnvelope],
  );

  const endTrip = useCallback(
    async (rideId: string) => {
      const ride = sessionRef.current.currentRide;
      await sendEnvelope('ride:end', {
        rideId,
        riderId: ride?.riderId ?? '',
        fareNgn: ride?.fareNgn,
        endedBy: 'both_confirmed',
      });
    },
    [sendEnvelope],
  );

  const sendGps = useCallback(
    (lat: number, lng: number) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      // With a ride: full trip telemetry keyed by rideId. Without one: an
      // idle position ping so the backend's copy of where this driver is
      // doesn't stay frozen at wherever they went online — matching and the
      // pickup distances riders see depend on it.
      const ride = sessionRef.current.currentRide;
      lastOnlineCoordsRef.current = { lat, lng };
      socket.send(
        JSON.stringify({
          type: 'driver:gps',
          payload: ride
            ? { rideId: ride.rideId, lat, lng, timestamp: new Date().toISOString() }
            : { lat, lng, timestamp: new Date().toISOString() },
        }),
      );
    },
    [],
  );

  const sendChatMessage = useCallback(
    async (rideId: string, content: string) => {
      await sendEnvelope('chat:send', { rideId, content });
    },
    [sendEnvelope],
  );

  const selectOffer = useCallback((rideId: string) => {
    setSession((prev) => {
      const offers = pruneExpiredOffers(prev.offers);
      const picked = offers.find((queued) => queued.rideId === rideId);
      if (!picked) return { ...prev, offers };
      return { ...prev, offers, status: 'offered', currentOffer: picked };
    });
  }, []);

  const closeOffer = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      offers: pruneExpiredOffers(prev.offers),
      currentOffer: null,
    }));
  }, []);

  const clearCompleted = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      status: 'online',
      offers: [],
      currentOffer: null,
      currentRide: null,
      pendingBids: {},
    }));
    setChatMessages([]);
    setError(null);
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!isBackendConfigured() || !isReady || !user) {
      shouldMaintainConnectionRef.current = false;
      clearReconnectTimer();
      connectPromiseRef.current = null;
      setConnectionState('disconnected');
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) socket.close();
      return;
    }
  }, [clearReconnectTimer, isReady, user]);

  const value = useMemo<DriverSessionContextValue>(
    () => ({
      isConfigured: isBackendConfigured(),
      connectionState,
      session,
      chatMessages,
      error,
      goOnline,
      goOffline,
      acceptRide,
      bidOnSeat,
      rejectRide,
      selectOffer,
      closeOffer,
      arriveAtPickup,
      startTrip,
      endTrip,
      sendGps,
      sendChatMessage,
      clearCompleted,
    }),
    [
      connectionState,
      session,
      chatMessages,
      error,
      goOnline,
      goOffline,
      acceptRide,
      bidOnSeat,
      rejectRide,
      selectOffer,
      closeOffer,
      arriveAtPickup,
      startTrip,
      endTrip,
      sendGps,
      sendChatMessage,
      clearCompleted,
    ],
  );

  return (
    <DriverSessionContext.Provider value={value}>
      {children}
    </DriverSessionContext.Provider>
  );
}

export function useDriverSession(): DriverSessionContextValue {
  return useContext(DriverSessionContext);
}
