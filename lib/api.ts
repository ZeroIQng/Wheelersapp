import Constants from "expo-constants";

function getExpoDevServerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === "string" && hostUri.trim().length > 0) {
    return hostUri.split(":")[0] ?? null;
  }

  const debuggerHost = Constants.expoGoConfig?.debuggerHost;
  if (typeof debuggerHost === "string" && debuggerHost.trim().length > 0) {
    return debuggerHost.split(":")[0] ?? null;
  }

  return null;
}

function resolveApiBaseUrl(rawValue: string | undefined): string | null {
  const normalized = rawValue?.trim().replace(/\/+$/, "");
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    const isLoopbackHost =
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "::1";

    if (!isLoopbackHost) {
      return url.toString().replace(/\/+$/, "");
    }

    const expoHost = getExpoDevServerHost();
    if (!expoHost) {
      return url.toString().replace(/\/+$/, "");
    }

    url.hostname = expoHost;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return normalized;
  }
}

const apiBaseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

function buildConnectivityErrorMessage(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const resolvedUrl = apiBaseUrl;

  if (!configuredUrl) {
    return "EXPO_PUBLIC_API_BASE_URL is not configured.";
  }

  return [
    "Could not reach the Wheelers backend.",
    `Configured API base URL: ${configuredUrl}.`,
    resolvedUrl && resolvedUrl !== configuredUrl
      ? `Resolved API base URL: ${resolvedUrl}.`
      : null,
    "If you are testing on a physical device, use your computer LAN IP or Expo dev host instead of 127.0.0.1/localhost.",
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");
}

export type BackendRole = "RIDER" | "DRIVER" | "BOTH";

export interface BackendUser {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  role: BackendRole;
  name: string | null;
  phone: string | null;
}

interface SyncPrivyAuthInput {
  accessToken: string;
  role?: BackendRole;
  authMethod?: "email" | "google" | "apple" | "wallet";
  email?: string;
  name?: string;
  phone?: string;
  walletAddress?: string;
}

interface SyncPrivyAuthResponse {
  created: boolean;
  user: BackendUser;
}

interface SendPhoneOtpInput {
  accessToken: string;
  phone: string;
}

interface SendPhoneOtpResponse {
  sent: boolean;
  phone: string;
  expiresInSeconds: number;
}

interface VerifyPhoneOtpInput {
  accessToken: string;
  code: string;
}

interface VerifyPhoneOtpResponse {
  verified: boolean;
  user: BackendUser;
}

export interface RideEstimateWaypoint {
  lat: number;
  lng: number;
  address: string;
}

export interface RideMapCoordinate {
  lat: number;
  lng: number;
}

export interface RideRouteBounds {
  northEast: RideMapCoordinate;
  southWest: RideMapCoordinate;
}

export interface RideRouteGeometry {
  coordinates: RideMapCoordinate[];
  bounds: RideRouteBounds;
}

export interface RideRouteSnapshot {
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops: RideEstimateWaypoint[];
  route: RideRouteGeometry;
}

export interface RideEstimateResponse {
  plannedDistanceKm: number;
  plannedDurationSeconds: number;
  fareEstimateUsdt: number;
  fareEstimateNgn?: number;
  pickup?: RideEstimateWaypoint;
  destination?: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
  route?: RideRouteGeometry;
}

export interface RiderHistoryRide {
  id: string;
  status: "COMPLETED" | "CANCELLED";
  pickupAddress: string;
  destAddress: string;
  fareEstimateUsdt: number | null;
  fareFinalUsdt: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  cancelReason: string | null;
  cancelStage: string | null;
  matchedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface RiderHistoryResponse {
  items: RiderHistoryRide[];
  nextCursor: string | null;
}

export interface ScheduledRide {
  id: string;
  status: "SCHEDULED" | "DISPATCHING" | "DISPATCHED" | "CANCELLED" | "EXPIRED";
  scheduledFor: string;
  paymentMethod: "wallet_balance" | "smart_account";
  pickupAddress: string;
  destAddress: string;
  plannedDistanceKm: number | null;
  plannedDurationSeconds: number | null;
  fareEstimateUsdt: number | null;
  requestedRideId: string | null;
  createdAt: string;
}

interface ScheduledRideListResponse {
  items: ScheduledRide[];
  nextCursor: string | null;
}

export interface PouchSession {
  id?: string;
  type?: string;
  status?: string;
  amount?: number;
  currency?: string;
  cryptoCurrency?: string;
  cryptoNetwork?: string;
  chain?: string;
  walletAddress?: string;
  walletTag?: string;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface PouchCreateSessionResponse {
  provider: "pouch";
  session: PouchSession;
  walletCreditable: boolean;
}

export interface PouchGetSessionResponse {
  provider: "pouch";
  session: PouchSession;
  sessionSynced: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseRideEstimateWaypoint(value: unknown): RideEstimateWaypoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    !isFiniteNumber(record.lat) ||
    !isFiniteNumber(record.lng) ||
    typeof record.address !== "string" ||
    record.address.trim().length === 0
  ) {
    return null;
  }

  return {
    lat: record.lat,
    lng: record.lng,
    address: record.address,
  };
}

export function parseRideRouteGeometry(value: unknown): RideRouteGeometry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const coordinatesValue = record.coordinates;
  if (!Array.isArray(coordinatesValue) || coordinatesValue.length < 2) {
    return null;
  }

  const coordinates = coordinatesValue
    .map((coordinate) => {
      if (!coordinate || typeof coordinate !== "object") {
        return null;
      }

      const parsed = coordinate as Record<string, unknown>;
      if (!isFiniteNumber(parsed.lat) || !isFiniteNumber(parsed.lng)) {
        return null;
      }

      return {
        lat: parsed.lat,
        lng: parsed.lng,
      };
    })
    .filter((coordinate): coordinate is RideMapCoordinate => coordinate != null);

  if (coordinates.length < 2) {
    return null;
  }

  const boundsValue = record.bounds;
  if (!boundsValue || typeof boundsValue !== "object") {
    return null;
  }

  const bounds = boundsValue as Record<string, unknown>;
  const northEast = bounds.northEast as Record<string, unknown> | undefined;
  const southWest = bounds.southWest as Record<string, unknown> | undefined;

  if (
    !northEast ||
    !southWest ||
    !isFiniteNumber(northEast.lat) ||
    !isFiniteNumber(northEast.lng) ||
    !isFiniteNumber(southWest.lat) ||
    !isFiniteNumber(southWest.lng)
  ) {
    return null;
  }

  return {
    coordinates,
    bounds: {
      northEast: {
        lat: northEast.lat,
        lng: northEast.lng,
      },
      southWest: {
        lat: southWest.lat,
        lng: southWest.lng,
      },
    },
  };
}

export function parseRideRouteSnapshot(value: unknown): RideRouteSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const pickup = parseRideEstimateWaypoint(record.pickup);
  const destination = parseRideEstimateWaypoint(record.destination);
  const route = parseRideRouteGeometry(record.route);
  const stopsValue = record.stops;

  if (!pickup || !destination || !route || !Array.isArray(stopsValue)) {
    return null;
  }

  const stops = stopsValue
    .map((stop) => parseRideEstimateWaypoint(stop))
    .filter((stop): stop is RideEstimateWaypoint => stop != null);

  if (stops.length !== stopsValue.length) {
    return null;
  }

  return {
    pickup,
    destination,
    stops,
    route,
  };
}

export function isBackendConfigured(): boolean {
  return Boolean(apiBaseUrl);
}

export function getApiBaseUrl(): string | null {
  return apiBaseUrl ?? null;
}

export function getBackendWebSocketUrl(): string | null {
  if (!apiBaseUrl) {
    return null;
  }

  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

async function postJson<TResponse>(
  path: string,
  body: unknown,
  options?: { accessToken?: string; fallbackError: string },
): Promise<TResponse> {
  if (!apiBaseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (options?.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).catch((error) => {
    throw new Error(
      error instanceof Error && error.message !== "Network request failed"
        ? error.message
        : buildConnectivityErrorMessage(),
    );
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, options?.fallbackError ?? "Request failed."),
    );
  }

  return (payload ?? {}) as TResponse;
}

async function getJson<TResponse>(
  path: string,
  options?: { accessToken?: string; fallbackError: string },
): Promise<TResponse> {
  if (!apiBaseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const headers: Record<string, string> = {};

  if (options?.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers,
  }).catch((error) => {
    throw new Error(
      error instanceof Error && error.message !== "Network request failed"
        ? error.message
        : buildConnectivityErrorMessage(),
    );
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, options?.fallbackError ?? "Request failed."),
    );
  }

  return (payload ?? {}) as TResponse;
}

export async function syncPrivyAuth(
  input: SyncPrivyAuthInput,
): Promise<SyncPrivyAuthResponse> {
  return postJson<SyncPrivyAuthResponse>("/auth/privy", input, {
    fallbackError: "Could not sync your account with Wheelers.",
  });
}

export async function sendPhoneOtp(
  input: SendPhoneOtpInput,
): Promise<SendPhoneOtpResponse> {
  return postJson<SendPhoneOtpResponse>(
    "/auth/phone/send-otp",
    { phone: input.phone },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not send the phone verification code.",
    },
  );
}

export async function verifyPhoneOtp(
  input: VerifyPhoneOtpInput,
): Promise<VerifyPhoneOtpResponse> {
  return postJson<VerifyPhoneOtpResponse>(
    "/auth/phone/verify-otp",
    { code: input.code },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not verify the phone code.",
    },
  );
}

export async function createPouchSession(input: {
  accessToken: string;
  type: "ONRAMP" | "OFFRAMP";
  amountLocal?: number;
  amountUsd?: number;
  countryCode: string;
  currency: string;
  cryptoCurrency: string;
  cryptoNetwork: string;
  walletAddress?: string;
}): Promise<PouchCreateSessionResponse> {
  return postJson<PouchCreateSessionResponse>(
    "/payments/pouch/sessions",
    {
      type: input.type,
      amountLocal: input.amountLocal,
      amountUsd: input.amountUsd,
      countryCode: input.countryCode,
      currency: input.currency,
      cryptoCurrency: input.cryptoCurrency,
      cryptoNetwork: input.cryptoNetwork,
      walletAddress: input.walletAddress,
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not start the Pouch deposit session.",
    },
  );
}

export async function getPouchSession(input: {
  accessToken: string;
  sessionId: string;
}): Promise<PouchGetSessionResponse> {
  return getJson<PouchGetSessionResponse>(
    `/payments/pouch/sessions/${encodeURIComponent(input.sessionId)}`,
    {
      accessToken: input.accessToken,
      fallbackError: "Could not refresh the Pouch deposit session.",
    },
  );
}

export async function getRideEstimate(input: {
  accessToken: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
}): Promise<RideEstimateResponse> {
  return postJson<RideEstimateResponse>(
    "/rides/estimate",
    {
      pickup: input.pickup,
      destination: input.destination,
      stops: input.stops ?? [],
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not calculate the ride estimate.",
    },
  );
}

export async function getRiderRideHistory(input: {
  accessToken: string;
  limit?: number;
  cursor?: string;
}): Promise<RiderHistoryResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set("limit", String(input.limit));
  }
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  const path = params.size > 0 ? `/rides/history?${params.toString()}` : "/rides/history";
  return getJson<RiderHistoryResponse>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load ride history.",
  });
}

export async function createScheduledRide(input: {
  accessToken: string;
  scheduledFor: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
  paymentMethod?: "wallet_balance" | "smart_account";
}): Promise<{ item: ScheduledRide }> {
  return postJson<{ item: ScheduledRide }>(
    "/scheduled-rides",
    {
      scheduledFor: input.scheduledFor,
      pickup: input.pickup,
      destination: input.destination,
      stops: input.stops ?? [],
      paymentMethod: input.paymentMethod ?? "wallet_balance",
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not schedule this ride.",
    },
  );
}

export async function getScheduledRides(input: {
  accessToken: string;
  limit?: number;
  cursor?: string;
}): Promise<ScheduledRideListResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set("limit", String(input.limit));
  }
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  const path =
    params.size > 0 ? `/scheduled-rides?${params.toString()}` : "/scheduled-rides";
  return getJson<ScheduledRideListResponse>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load scheduled rides.",
  });
}

export async function cancelScheduledRide(input: {
  accessToken: string;
  scheduledRideId: string;
  reason?: string;
}): Promise<{ cancelled: boolean; scheduledRideId: string }> {
  return postJson<{ cancelled: boolean; scheduledRideId: string }>(
    `/scheduled-rides/${encodeURIComponent(input.scheduledRideId)}/cancel`,
    input.reason ? { reason: input.reason } : {},
    {
      accessToken: input.accessToken,
      fallbackError: "Could not cancel scheduled ride.",
    },
  );
}
