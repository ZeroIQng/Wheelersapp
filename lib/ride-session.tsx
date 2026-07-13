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
  parseRideEstimateWaypoint,
  parseRideRouteGeometry,
  parseRideRouteSnapshot,
  type RideEstimateWaypoint,
  type RideRouteSnapshot,
} from '@/lib/api';
import { resolvePlaceQuery } from '@/lib/google-places';
import { serializeRideItinerary, type RideItinerary } from '@/lib/ride-route';
import { invalidateWalletCache } from '@/lib/wallet-overview';

type RideConnectionState = 'disconnected' | 'connecting' | 'connected';
type RideStatus =
  | 'idle'
  | 'requesting'
  | 'matching'
  | 'matched'
  | 'active'
  | 'completed'
  | 'cancelled';

type RideDriver = {
  driverId: string;
  driverName?: string;
  driverRating?: number;
  vehiclePlate?: string;
  vehicleModel?: string;
  etaSeconds?: number;
  lockedFareNgn?: number;
};

type RideDriverLocation = {
  lat: number;
  lng: number;
  distanceToNextStopKm?: number;
  nextStopAddress?: string;
  nextStopOrder?: number;
  remainingStopCount?: number;
  totalDistanceKm?: number;
  isStale?: boolean;
};

export type RiderRideState = {
  rideId: string;
  status: RideStatus;
  itinerary: RideItinerary;
  fareEstimateNgn?: number;
  plannedDistanceKm?: number;
  plannedDurationSeconds?: number;
  route?: RideRouteSnapshot;
  driver?: RideDriver;
  driverLocation?: RideDriverLocation;
  startedAt?: string;
  completedAt?: string;
  completedFareNgn?: number;
  cancelReason?: string;
  cancelStage?: string;
};

export type RideChatMessage = {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: 'RIDER' | 'DRIVER';
  content: string;
  createdAt: string;
};

type RideSessionContextValue = {
  isConfigured: boolean;
  connectionState: RideConnectionState;
  currentRide: RiderRideState | null;
  chatMessages: RideChatMessage[];
  error: string | null;
  requestRide: (itinerary: RideItinerary) => Promise<void>;
  simulateMatchedRide: (input: {
    itinerary: RideItinerary;
    route?: RideRouteSnapshot | null;
    fareEstimateNgn?: number;
    plannedDistanceKm?: number;
    plannedDurationSeconds?: number;
  }) => void;
  updateRideRoute: (itinerary: RideItinerary) => Promise<void>;
  cancelRide: (reason?: string) => Promise<void>;
  sendChatMessage: (rideId: string, content: string) => Promise<void>;
  clearRide: () => void;
};

type GatewayMessage = {
  type?: string;
  payload?: Record<string, unknown>;
};

type ResolvedRoute = {
  pickup: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  stops: Array<{ lat: number; lng: number; address: string }>;
};

const accessTokenRetryAttempts = 6;
const accessTokenRetryDelayMs = 250;
const reconnectDelayMs = 1500;

function buildRideSessionConnectionError(wsBaseUrl: string): Error {
  return new Error(
    [
      'Could not connect to the live ride session.',
      `WebSocket URL: ${wsBaseUrl}.`,
      'Check that the API gateway is running, reachable from this device, and accepting /ws connections.',
    ].join(' '),
  );
}

const defaultContext: RideSessionContextValue = {
  isConfigured: false,
  connectionState: 'disconnected',
  currentRide: null,
  chatMessages: [],
  error: null,
  requestRide: async () => {
    throw new Error('Ride session is unavailable.');
  },
  simulateMatchedRide: () => undefined,
  updateRideRoute: async () => {
    throw new Error('Ride session is unavailable.');
  },
  cancelRide: async () => {
    throw new Error('Ride session is unavailable.');
  },
  sendChatMessage: async () => {
    throw new Error('Ride session is unavailable.');
  },
  clearRide: () => undefined,
};

const RideSessionContext = createContext<RideSessionContextValue>(defaultContext);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function isTerminalRideStatus(status: RideStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

function formatCancelStage(ride: RiderRideState):
  | 'before_match'
  | 'after_match'
  | 'driver_en_route'
  | 'active_trip' {
  if (ride.status === 'active') {
    return 'active_trip';
  }

  if (ride.status === 'matched') {
    return 'driver_en_route';
  }

  if (ride.status === 'matching') {
    return 'after_match';
  }

  return 'before_match';
}

function parseRouteStopAddresses(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => getRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => item.type === 'intermediate')
    .sort((left, right) => {
      const leftOrder = getNumber(left.stopOrder) ?? 0;
      const rightOrder = getNumber(right.stopOrder) ?? 0;
      return leftOrder - rightOrder;
    })
    .map((item) => getString(item.address))
    .filter((item): item is string => Boolean(item));
}

function parseWaypointList(value: unknown): RideEstimateWaypoint[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const waypoints = value
    .map((item) => parseRideEstimateWaypoint(item))
    .filter((item): item is RideEstimateWaypoint => item != null);

  return waypoints.length === value.length ? waypoints : null;
}

async function getAccessTokenWithRetry(
  getAccessToken: () => Promise<string | null | undefined>,
): Promise<string | null> {
  for (let attempt = 0; attempt < accessTokenRetryAttempts; attempt += 1) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      return accessToken;
    }

    if (attempt < accessTokenRetryAttempts - 1) {
      await sleep(accessTokenRetryDelayMs);
    }
  }

  return null;
}

async function resolveRideRoute(itinerary: RideItinerary): Promise<ResolvedRoute> {
  const pickup = await resolvePlaceQuery(itinerary.pickup);
  const stopLabels = itinerary.stops.slice(0, -1);
  const destinationLabel = itinerary.stops[itinerary.stops.length - 1];

  if (!destinationLabel) {
    throw new Error('A destination is required before requesting a ride.');
  }

  const [destination, ...stops] = await Promise.all([
    resolvePlaceQuery(destinationLabel),
    ...stopLabels.map((stop) => resolvePlaceQuery(stop)),
  ]);

  return {
    pickup,
    destination,
    stops,
  };
}

export function RideSessionProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, isReady, user } = useAuth();
  const [connectionState, setConnectionState] = useState<RideConnectionState>('disconnected');
  const [currentRide, setCurrentRide] = useState<RiderRideState | null>(null);
  const [chatMessages, setChatMessages] = useState<RideChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const connectPromiseRef = useRef<Promise<WebSocket> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldMaintainConnectionRef = useRef(false);
  const currentRideRef = useRef<RiderRideState | null>(null);
  const userRef = useRef(user);

  const setRideState = useCallback(
    (updater: RiderRideState | null | ((previous: RiderRideState | null) => RiderRideState | null)) => {
      setCurrentRide((previous) => {
        const next = typeof updater === 'function' ? updater(previous) : updater;
        currentRideRef.current = next;
        return next;
      });
    },
    [],
  );

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) {
      return;
    }

    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const clearRide = useCallback(() => {
    setError(null);
    setRideState(null);
    setChatMessages([]);
  }, [setRideState]);

  const handleGatewayMessage = useCallback(
    (message: GatewayMessage) => {
      const type = getString(message.type);
      const payload = getRecord(message.payload) ?? {};

      if (!type) {
        return;
      }

      if (type === 'error') {
        setError(getString(payload.message) ?? 'Ride session error.');
        return;
      }

      if (type === 'ride:request:accepted') {
        setError(null);
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'matching',
            route: parseRideRouteSnapshot(payload) ?? previous.route,
            plannedDistanceKm:
              getNumber(payload.plannedDistanceKm) ?? previous.plannedDistanceKm,
            plannedDurationSeconds:
              getNumber(payload.plannedDurationSeconds) ?? previous.plannedDurationSeconds,
            fareEstimateNgn: getNumber(payload.fareEstimateNgn) ?? previous.fareEstimateNgn,
          };
        });
        return;
      }

      if (type === 'ride:matched') {
        setError(null);
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'matched',
            driver: {
              driverId: getString(payload.driverId) ?? previous.driver?.driverId ?? '',
              driverName: getString(payload.driverName) ?? previous.driver?.driverName,
              driverRating: getNumber(payload.driverRating) ?? previous.driver?.driverRating,
              vehiclePlate: getString(payload.vehiclePlate) ?? previous.driver?.vehiclePlate,
              vehicleModel: getString(payload.vehicleModel) ?? previous.driver?.vehicleModel,
              etaSeconds: getNumber(payload.etaSeconds) ?? previous.driver?.etaSeconds,
              lockedFareNgn:
                getNumber(payload.lockedFareNgn) ?? previous.driver?.lockedFareNgn,
            },
          };
        });
        return;
      }

      if (type === 'ride:route:updated') {
        setError(null);
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          const destination = getRecord(payload.destination);
          const destinationAddress = getString(destination?.address);
          const stopAddresses = parseRouteStopAddresses(payload.stops);
          const pickup =
            parseRideEstimateWaypoint(payload.pickup) ?? previous.route?.pickup;
          const updatedDestination =
            parseRideEstimateWaypoint(payload.destination) ?? previous.route?.destination;
          const updatedStops = parseWaypointList(payload.stops) ?? previous.route?.stops;
          const updatedRoute = parseRideRouteGeometry(payload.route);

          return {
            ...previous,
            itinerary: destinationAddress
              ? {
                  pickup: previous.itinerary.pickup,
                  stops: [...stopAddresses, destinationAddress],
                }
              : previous.itinerary,
            plannedDistanceKm:
              getNumber(payload.plannedDistanceKm) ?? previous.plannedDistanceKm,
            plannedDurationSeconds:
              getNumber(payload.plannedDurationSeconds) ?? previous.plannedDurationSeconds,
            fareEstimateNgn: getNumber(payload.fareEstimateNgn) ?? previous.fareEstimateNgn,
            route:
              pickup && updatedDestination && updatedStops && updatedRoute
                ? {
                    pickup,
                    destination: updatedDestination,
                    stops: updatedStops,
                    route: updatedRoute,
                  }
                : previous.route,
          };
        });
        return;
      }

      if (type === 'ride:driver_location') {
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            driverLocation: {
              lat: getNumber(payload.lat) ?? previous.driverLocation?.lat ?? 0,
              lng: getNumber(payload.lng) ?? previous.driverLocation?.lng ?? 0,
              distanceToNextStopKm:
                getNumber(payload.distanceToNextStopKm) ??
                previous.driverLocation?.distanceToNextStopKm,
              nextStopAddress:
                getString(payload.nextStopAddress) ?? previous.driverLocation?.nextStopAddress,
              nextStopOrder:
                getNumber(payload.nextStopOrder) ?? previous.driverLocation?.nextStopOrder,
              remainingStopCount:
                getNumber(payload.remainingStopCount) ??
                previous.driverLocation?.remainingStopCount,
              totalDistanceKm:
                getNumber(payload.totalDistanceKm) ?? previous.driverLocation?.totalDistanceKm,
              isStale:
                typeof payload.isStale === 'boolean'
                  ? payload.isStale
                  : previous.driverLocation?.isStale,
            },
          };
        });
        return;
      }

      if (type === 'ride:started') {
        setError(null);
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'active',
            startedAt: getString(payload.startedAt) ?? previous.startedAt,
          };
        });
        return;
      }

      if (type === 'ride:completed') {
        setError(null);
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'completed',
            completedAt: getString(payload.completedAt) ?? previous.completedAt,
            completedFareNgn: getNumber(payload.fareNgn) ?? previous.completedFareNgn,
            plannedDistanceKm:
              getNumber(payload.distanceKm) ?? previous.plannedDistanceKm,
            plannedDurationSeconds:
              getNumber(payload.durationSeconds) ?? previous.plannedDurationSeconds,
          };
        });
        return;
      }

      if (type === 'ride:cancelled') {
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'cancelled',
            cancelReason: getString(payload.reason) ?? previous.cancelReason,
            cancelStage: getString(payload.cancelStage) ?? previous.cancelStage,
          };
        });
        return;
      }

      if (type === 'ride:driver_rejected') {
        setError('A driver skipped this request. Reassigning another nearby driver.');
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

        const msg: RideChatMessage = {
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

      if (type === 'group-ride:driver-assigned') {
        setError(null);
        setRideState((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'matched',
            driver: {
              driverId: getString(payload.driverId) ?? previous.driver?.driverId ?? '',
              driverName: getString(payload.driverName) ?? previous.driver?.driverName,
              driverRating: getNumber(payload.driverRating) ?? previous.driver?.driverRating,
              vehiclePlate: getString(payload.vehiclePlate) ?? previous.driver?.vehiclePlate,
              vehicleModel: getString(payload.vehicleModel) ?? previous.driver?.vehicleModel,
              etaSeconds: getNumber(payload.etaSeconds) ?? previous.driver?.etaSeconds,
            },
          };
        });
        return;
      }

      if (type === 'wallet:updated') {
        invalidateWalletCache();
        return;
      }
    },
    [setRideState],
  );

  const scheduleReconnect = useCallback(() => {
    if (!shouldMaintainConnectionRef.current || !userRef.current || reconnectTimerRef.current) {
      return;
    }

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!shouldMaintainConnectionRef.current || !userRef.current) {
        return;
      }

      void connect().catch(() => undefined);
    }, reconnectDelayMs);
  }, []);

  const connect = useCallback(async (): Promise<WebSocket> => {
    if (!isBackendConfigured()) {
      throw new Error('Set EXPO_PUBLIC_API_BASE_URL before requesting rides.');
    }

    if (!isReady || !user) {
      throw new Error('Sign in before requesting a ride.');
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
      throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
    }

    setConnectionState('connecting');
    clearReconnectTimer();

    connectPromiseRef.current = (async () => {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) {
        throw new Error('Could not get a Privy access token for ride updates.');
      }

      const socketUrl = new URL(wsBaseUrl);
      socketUrl.searchParams.set('accessToken', accessToken);
      const connectionError = buildRideSessionConnectionError(wsBaseUrl);

      return await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(socketUrl.toString());
        let settled = false;

        socketRef.current = socket;

        socket.onopen = () => {
          settled = true;
          setConnectionState('connected');
          setError(null);
          resolve(socket);
        };

        socket.onmessage = (event) => {
          const raw = typeof event.data === 'string' ? event.data : '';
          if (!raw) {
            return;
          }

          try {
            handleGatewayMessage(JSON.parse(raw) as GatewayMessage);
          } catch {
            setError('Received an invalid live ride update.');
          }
        };

        socket.onerror = () => {
          if (settled) {
            return;
          }

          settled = true;
          setConnectionState('disconnected');
          setError(connectionError.message);
          reject(connectionError);
        };

        socket.onclose = () => {
          socketRef.current = null;
          setConnectionState('disconnected');
          if (!settled) {
            settled = true;
            setError(connectionError.message);
            reject(connectionError);
            return;
          }
          scheduleReconnect();
        };
      });
    })();

    try {
      return await connectPromiseRef.current;
    } finally {
      connectPromiseRef.current = null;
    }
  }, [
    clearReconnectTimer,
    getAccessToken,
    handleGatewayMessage,
    isReady,
    scheduleReconnect,
    user,
  ]);

  const sendEnvelope = useCallback(
    async (type: string, payload: Record<string, unknown>): Promise<void> => {
      const socket = await connect();

      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error('Ride session is not connected yet.');
      }

      socket.send(JSON.stringify({ type, payload }));
    },
    [connect],
  );

  const requestRide = useCallback(
    async (itinerary: RideItinerary): Promise<void> => {
      if (!isBackendConfigured()) {
        throw new Error('Set EXPO_PUBLIC_API_BASE_URL before requesting rides.');
      }

      const itineraryKey = serializeRideItinerary(itinerary);
      const existingRide = currentRideRef.current;
      if (existingRide && !isTerminalRideStatus(existingRide.status)) {
        const existingKey = serializeRideItinerary(existingRide.itinerary);
        if (existingKey === itineraryKey) {
          return;
        }

        throw new Error('You already have a ride in progress.');
      }

      const rideId = Crypto.randomUUID();

      setError(null);
      setRideState({
        rideId,
        status: 'requesting',
        itinerary,
      });

      try {
        const resolvedRoute = await resolveRideRoute(itinerary);

        await sendEnvelope('ride:request', {
          rideId,
          pickup: resolvedRoute.pickup,
          destination: resolvedRoute.destination,
          stops: resolvedRoute.stops,
          paymentMethod: 'wallet_balance',
        });
      } catch (requestError) {
        setRideState(null);
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Could not request this ride.';
        setError(message);
      }
    },
    [sendEnvelope, setRideState, user],
  );

  const simulateMatchedRide = useCallback(
    (input: {
      itinerary: RideItinerary;
      route?: RideRouteSnapshot | null;
      fareEstimateNgn?: number;
      plannedDistanceKm?: number;
      plannedDurationSeconds?: number;
    }) => {
      const rideId = `mock-${Crypto.randomUUID()}`;
      setError(null);
      setRideState({
        rideId,
        status: 'matched',
        itinerary: input.itinerary,
        fareEstimateNgn: input.fareEstimateNgn,
        plannedDistanceKm: input.plannedDistanceKm,
        plannedDurationSeconds: input.plannedDurationSeconds,
        route: input.route ?? undefined,
        driver: {
          driverId: 'mock-driver-ade',
          driverName: 'Ade Martins',
          driverRating: 4.9,
          vehiclePlate: 'WLR 482 KT',
          vehicleModel: 'Toyota Corolla',
          etaSeconds: 240,
          lockedFareNgn: input.fareEstimateNgn,
        },
        driverLocation: input.route?.pickup
          ? {
              lat: input.route.pickup.lat + 0.006,
              lng: input.route.pickup.lng - 0.004,
              distanceToNextStopKm: 1.2,
              nextStopAddress: input.route.pickup.address,
              nextStopOrder: 0,
              remainingStopCount: input.itinerary.stops.length,
              totalDistanceKm: input.plannedDistanceKm,
              isStale: false,
            }
          : undefined,
      });
    },
    [setRideState],
  );

  const updateRideRoute = useCallback(
    async (itinerary: RideItinerary): Promise<void> => {
      const activeRide = currentRideRef.current;
      if (!activeRide?.rideId) {
        throw new Error('There is no live ride route to update yet.');
      }

      const resolvedRoute = await resolveRideRoute(itinerary);
      setError(null);

      await sendEnvelope('ride:route:update', {
        rideId: activeRide.rideId,
        driverId: activeRide.driver?.driverId,
        destination: resolvedRoute.destination,
        stops: resolvedRoute.stops,
      });

      setRideState((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          itinerary,
        };
      });
    },
    [sendEnvelope, setRideState],
  );

  const cancelRide = useCallback(
    async (reason?: string): Promise<void> => {
      const activeRide = currentRideRef.current;
      if (!activeRide?.rideId) {
        clearRide();
        return;
      }

      setError(null);

      await sendEnvelope('ride:cancel', {
        rideId: activeRide.rideId,
        driverId: activeRide.driver?.driverId,
        cancelStage: formatCancelStage(activeRide),
        reason,
      });
    },
    [clearRide, sendEnvelope, user],
  );

  const sendChatMessage = useCallback(
    async (rideId: string, content: string): Promise<void> => {
      await sendEnvelope('chat:send', { rideId, content });
    },
    [sendEnvelope],
  );

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
      if (socket) {
        socket.close();
      }

      return;
    }

    shouldMaintainConnectionRef.current = true;
    void connect().catch((connectionError) => {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : 'Could not start the ride session.',
      );
    });

    return () => {
      shouldMaintainConnectionRef.current = false;
      clearReconnectTimer();
    };
  }, [clearReconnectTimer, connect, isReady, user]);

  const value = useMemo<RideSessionContextValue>(
    () => ({
      isConfigured: isBackendConfigured(),
      connectionState,
      currentRide,
      chatMessages,
      error,
      requestRide,
      simulateMatchedRide,
      updateRideRoute,
      cancelRide,
      sendChatMessage,
      clearRide,
    }),
    [
      cancelRide,
      chatMessages,
      clearRide,
      connectionState,
      currentRide,
      error,
      requestRide,
      sendChatMessage,
      simulateMatchedRide,
      updateRideRoute,
    ],
  );

  return (
    <RideSessionContext.Provider value={value}>
      {children}
    </RideSessionContext.Provider>
  );
}

export function useRideSession(): RideSessionContextValue {
  return useContext(RideSessionContext);
}
