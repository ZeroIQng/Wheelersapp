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
  plannedDistanceKm?: number;
  plannedDurationSeconds?: number;
  expiresAt: string;
  route?: RideRouteGeometry;
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
};

export type ChatMessage = {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: 'RIDER' | 'DRIVER';
  content: string;
  createdAt: string;
};

export type DriverSessionState = {
  status: DriverStatus;
  currentOffer: RideOffer | null;
  currentRide: DriverRide | null;
};

type DriverSessionContextValue = {
  isConfigured: boolean;
  connectionState: DriverConnectionState;
  session: DriverSessionState;
  chatMessages: ChatMessage[];
  error: string | null;
  goOnline: (lat: number, lng: number) => Promise<void>;
  goOffline: () => Promise<void>;
  acceptRide: (rideId: string, counterOfferNgn?: number) => Promise<void>;
  rejectRide: (rideId: string) => Promise<void>;
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
  currentOffer: null,
  currentRide: null,
};

const defaultContext: DriverSessionContextValue = {
  isConfigured: false,
  connectionState: 'disconnected',
  session: defaultSession,
  chatMessages: [],
  error: null,
  goOnline: async (_lat: number, _lng: number) => { throw new Error('Driver session unavailable.'); },
  goOffline: async () => { throw new Error('Driver session unavailable.'); },
  acceptRide: async (_rideId: string, _counterOfferNgn?: number) => { throw new Error('Driver session unavailable.'); },
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

        setSession((prev) => ({
          ...prev,
          status: 'offered',
          currentOffer: {
            rideId: getString(payload.rideId) ?? '',
            riderId: getString(payload.riderId) ?? '',
            pickup,
            destination,
            stops: parseWaypointList(payload.stops),
            fareEstimateNgn: getNumber(payload.fareEstimateNgn) ?? 0,
            plannedDistanceKm: getNumber(payload.plannedDistanceKm),
            plannedDurationSeconds: getNumber(payload.plannedDurationSeconds),
            expiresAt: getString(payload.expiresAt) ?? '',
            route: payload.route as RideRouteGeometry | undefined,
          },
        }));
        return;
      }

      if (type === 'driver:accept:accepted' || type === 'ride:matched') {
        setSession((prev) => {
          const offer = prev.currentOffer;
          if (!offer) return prev;

          return {
            ...prev,
            status: 'navigating',
            currentOffer: null,
            currentRide: {
              rideId: offer.rideId,
              riderId: offer.riderId,
              pickup: offer.pickup,
              destination: offer.destination,
              stops: offer.stops,
              fareNgn: offer.fareEstimateNgn,
              plannedDistanceKm: offer.plannedDistanceKm,
              plannedDurationSeconds: offer.plannedDurationSeconds,
              route: offer.route,
            },
          };
        });
        return;
      }

      if (type === 'driver:reject:accepted') {
        setSession((prev) => ({
          ...prev,
          status: prev.currentRide ? prev.status : 'online',
          currentOffer: null,
        }));
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
        setSession((prev) => ({
          ...prev,
          status: 'online',
          currentOffer: null,
          currentRide: null,
        }));
        setError('Ride was cancelled.');
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
      throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
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
    try {
      await connect();
      console.log('[driver-session] connected, sending driver:online');
      await sendEnvelope('driver:online', { lat, lng });
      console.log('[driver-session] driver:online sent');
      setSession((prev) => ({ ...prev, status: 'online' }));
      setError(null);
    } catch {
      // Silent retry — don't show connection errors to the driver
      console.log('[driver-session] connection failed, will retry');
      scheduleReconnect();
    }
  }, [connect, sendEnvelope, scheduleReconnect]);

  const goOffline = useCallback(async () => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'driver:offline', payload: { reason: 'manual' } }));
    }
    shouldMaintainConnectionRef.current = false;
    clearReconnectTimer();
    socketRef.current = null;
    if (socket) socket.close();
    connectPromiseRef.current = null;
    setConnectionState('disconnected');
    setSession(defaultSession);
    setError(null);
  }, [clearReconnectTimer]);

  const acceptRide = useCallback(
    async (rideId: string, counterOfferNgn?: number) => {
      const offer = sessionRef.current.currentOffer;
      if (!offer || offer.rideId !== rideId) {
        throw new Error('No matching ride offer to accept.');
      }

      await sendEnvelope('driver:accept', {
        rideId,
        riderId: offer.riderId,
        driverName: 'Driver',
        driverRating: 5.0,
        vehiclePlate: 'N/A',
        vehicleModel: 'N/A',
        etaSeconds: 300,
        agreedFareNgn: counterOfferNgn ?? offer.fareEstimateNgn,
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
        driverId: '',
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
        driverId: '',
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
      socket.send(
        JSON.stringify({
          type: 'driver:gps',
          payload: { lat, lng, timestamp: new Date().toISOString() },
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

  const clearCompleted = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      status: 'online',
      currentOffer: null,
      currentRide: null,
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
      rejectRide,
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
      rejectRide,
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
