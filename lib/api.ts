const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(
  /\/+$/,
  "",
);

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

export interface RideEstimateResponse {
  plannedDistanceKm: number;
  plannedDurationSeconds: number;
  fareEstimateUsdt: number;
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
