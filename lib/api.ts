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
  username: string | null;
  email: string | null;
  role: BackendRole;
  name: string | null;
  phone: string | null;
}

interface UsernamePasswordAuthResponse {
  created?: boolean;
  accessToken: string;
  tokenType: "Bearer";
  user: BackendUser;
}

interface CurrentProfileResponse {
  user: BackendUser;
}

export interface ReferralSummaryResponse {
  code: string;
  availableCashbackNgn: number;
  frozenCashbackNgn: number;
  reservedCashbackNgn?: number;
  usedCashbackNgn: number;
  pendingReferrals: number;
  qualifiedReferrals: number;
  expiredNoRideReferrals: number;
  closedReferrals: number;
}

export interface ApplyReferralCodeResponse {
  referral: {
    id: string;
    referrerId: string;
    status: string;
    appliedAt: string;
    expiresAt: string;
    closesAt: string;
  };
  unlockedCashback: {
    id: string;
    amountNgn: number;
  } | null;
}

interface SendPhoneOtpInput {
  accessToken: string;
  phone: string;
}

interface SendPhoneOtpResponse {
  sent: boolean;
  channel?: "whatsapp" | "sms";
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
  fareEstimateNgn: number;
  pickup?: RideEstimateWaypoint;
  destination?: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
  route?: RideRouteGeometry;
}

const RIDE_ESTIMATE_CACHE_TTL_MS = 20 * 1000;
const rideEstimateCache = new Map<
  string,
  { value: RideEstimateResponse; cachedAt: number }
>();
const rideEstimateInflight = new Map<string, Promise<RideEstimateResponse>>();

function buildRideEstimateCacheKey(input: {
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
}): string {
  const serializeWaypoint = (waypoint: RideEstimateWaypoint): string =>
    [
      waypoint.lat.toFixed(6),
      waypoint.lng.toFixed(6),
      waypoint.address.trim().toLowerCase(),
    ].join("|");

  return JSON.stringify({
    pickup: serializeWaypoint(input.pickup),
    destination: serializeWaypoint(input.destination),
    stops: (input.stops ?? []).map(serializeWaypoint),
  });
}

export interface RiderHistoryRide {
  id: string;
  status: "COMPLETED" | "CANCELLED";
  pickupAddress: string;
  destAddress: string;
  fareEstimateNgn: number | null;
  fareFinalNgn: number | null;
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
  paymentMethod: "wallet_balance";
  pickupAddress: string;
  destAddress: string;
  plannedDistanceKm: number | null;
  plannedDurationSeconds: number | null;
  fareEstimateNgn: number | null;
  requestedRideId: string | null;
  createdAt: string;
}

interface ScheduledRideListResponse {
  items: ScheduledRide[];
  nextCursor: string | null;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  referenceId: string | null;
  referenceType: string | null;
  read: boolean;
  createdAt: string;
}

export interface GroupRideFaceVerificationSummary {
  id: string;
  uploadStatus: "UPLOADING" | "STORED" | "FAILED";
  mimeType: string;
  sizeBytes: number | null;
  capturedAt: string | null;
  storedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export type GroupRideGenderPreference = "any" | "women_only" | "men_only";

export interface GroupRideMatchRequest {
  id: string;
  userId: string;
  status:
    | "PENDING_FACE_UPLOAD"
    | "READY_FOR_MATCH"
    | "MATCHING"
    | "GROUPED"
    | "BOOKED"
    | "EXPIRED"
    | "CANCELLED";
  groupId: string | null;
  matchedRideIds: string[];
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops: RideEstimateWaypoint[];
  plannedDistanceKm: number | null;
  plannedDurationSeconds: number | null;
  fareEstimateNgn: number | null;
  genderPreference: GroupRideGenderPreference;
  paymentMethod: "wallet_balance";
  readyForMatchAt: string | null;
  matchingStartedAt: string | null;
  groupedAt: string | null;
  bookedAt: string | null;
  expiredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  faceVerification: GroupRideFaceVerificationSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupRideMatchedRider {
  rideId: string;
  userId: string;
  name: string | null;
  username: string | null;
  photoUrl: string | null;
  pickupAddress: string;
  destinationAddress: string;
  status: GroupRideMatchRequest["status"];
}

export interface GroupRideFaceUploadDescriptor {
  bucket: string;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  mimeType: string;
}

export interface WalletOverviewResponse {
  walletId: string;
  balanceNgn: number;
  lockedNgn: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  direction: "CREDIT" | "DEBIT";
  amountNgn: number;
  balanceAfterNgn: number;
  referenceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface WalletTransactionsResponse {
  items: WalletTransaction[];
  nextCursor: string | null;
}

export interface WalletWithdrawal {
  id: string;
  status: string;
  requestedAmountNgn: number;
  quotedAmountNgn: number | null;
  payoutCurrency: string;
  bankAccount: {
    accountNumber: string;
    accountName: string;
    networkId: string;
  };
  providerReference: string | null;
  failureReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  settledAt: string | null;
  failedAt: string | null;
}

export interface CreateWalletWithdrawalResponse {
  withdrawal: WalletWithdrawal | null;
}

export interface WithdrawalBankNetwork {
  id: string;
  uuid?: string;
  name: string;
  code: string | null;
  country: string | null;
  accountNumberType: string | null;
  type: string | null;
}

export interface WithdrawalBankNetworksResponse {
  country: string;
  items: WithdrawalBankNetwork[];
}

export interface VerifyWithdrawalBankAccountResponse {
  bankAccount: {
    accountNumber: string;
    accountName: string | null;
    bankName: string | null;
    networkId: string;
  };
  verificationSessionId: string | null;
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

async function requestJson<TResponse>(
  method: "GET" | "POST" | "PUT",
  path: string,
  options: {
    accessToken?: string;
    body?: unknown;
    idempotencyKey?: string;
    fallbackError: string;
  },
): Promise<TResponse> {
  if (!apiBaseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  if (options.idempotencyKey) {
    headers["idempotency-key"] = options.idempotencyKey;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
      getErrorMessage(payload, options.fallbackError ?? "Request failed."),
    );
  }

  return (payload ?? {}) as TResponse;
}

async function postJson<TResponse>(
  path: string,
  body: unknown,
  options?: { accessToken?: string; idempotencyKey?: string; fallbackError: string },
): Promise<TResponse> {
  return requestJson<TResponse>("POST", path, {
    accessToken: options?.accessToken,
    idempotencyKey: options?.idempotencyKey,
    body,
    fallbackError: options?.fallbackError ?? "Request failed.",
  });
}

async function getJson<TResponse>(
  path: string,
  options?: { accessToken?: string; fallbackError: string },
): Promise<TResponse> {
  return requestJson<TResponse>("GET", path, {
    accessToken: options?.accessToken,
    fallbackError: options?.fallbackError ?? "Request failed.",
  });
}

export async function signupWithUsernamePassword(input: {
  username: string;
  password: string;
  role?: BackendRole;
}): Promise<UsernamePasswordAuthResponse> {
  return postJson<UsernamePasswordAuthResponse>(
    "/auth/signup",
    {
      username: input.username,
      password: input.password,
      role: input.role ?? "RIDER",
    },
    {
      fallbackError: "Could not create your account.",
    },
  );
}

export async function signinWithUsernamePassword(input: {
  username: string;
  password: string;
}): Promise<UsernamePasswordAuthResponse> {
  return postJson<UsernamePasswordAuthResponse>(
    "/auth/signin",
    {
      username: input.username,
      password: input.password,
    },
    {
      fallbackError: "Could not sign in.",
    },
  );
}

// ── Social Auth ─────────────────────────────────────────────────────────

interface SocialAuthResponse {
  accessToken: string;
  tokenType: "Bearer";
  user: BackendUser;
}

export async function signInWithApple(input: {
  idToken: string;
  name?: string;
}): Promise<SocialAuthResponse> {
  return postJson<SocialAuthResponse>(
    "/auth/apple",
    { idToken: input.idToken, name: input.name },
    { fallbackError: "Apple sign-in failed." },
  );
}

export async function signInWithGoogle(input: {
  idToken: string;
}): Promise<SocialAuthResponse> {
  return postJson<SocialAuthResponse>(
    "/auth/google",
    { idToken: input.idToken },
    { fallbackError: "Google sign-in failed." },
  );
}

export async function sendPhoneOtp(
  input: SendPhoneOtpInput,
): Promise<SendPhoneOtpResponse> {
  return postJson<SendPhoneOtpResponse>(
    "/auth/phone/send-otp",
    { phone: input.phone },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not send the WhatsApp verification code.",
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
      fallbackError: "Could not verify the WhatsApp code.",
    },
  );
}

export async function getCurrentProfile(input: {
  accessToken: string;
}): Promise<CurrentProfileResponse> {
  return getJson<CurrentProfileResponse>("/auth/me", {
    accessToken: input.accessToken,
    fallbackError: "Could not load your profile.",
  });
}

export async function getReferralSummary(input: {
  accessToken: string;
}): Promise<ReferralSummaryResponse> {
  return getJson<ReferralSummaryResponse>("/referrals/me", {
    accessToken: input.accessToken,
    fallbackError: "Could not load your referral code.",
  });
}

export async function applyReferralCode(input: {
  accessToken: string;
  code: string;
}): Promise<ApplyReferralCodeResponse> {
  return postJson<ApplyReferralCodeResponse>(
    "/referrals/apply",
    { code: input.code },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not apply this referral code.",
    },
  );
}

export async function updateCurrentProfile(input: {
  accessToken: string;
  username?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}): Promise<CurrentProfileResponse> {
  return requestJson<CurrentProfileResponse>(
    "PUT",
    "/auth/profile",
    {
      body: {
        username: input.username,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
      },
      accessToken: input.accessToken,
      fallbackError: "Could not update your profile.",
    },
  );
}

export async function getWalletOverview(input: {
  accessToken: string;
}): Promise<WalletOverviewResponse> {
  return getJson<WalletOverviewResponse>("/wallet/overview", {
    accessToken: input.accessToken,
    fallbackError: "Could not load wallet overview.",
  });
}

export async function getWalletTransactions(input: {
  accessToken: string;
  limit?: number;
  cursor?: string;
}): Promise<WalletTransactionsResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set("limit", String(input.limit));
  }
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  const path =
    params.size > 0 ? `/wallet/transactions?${params.toString()}` : "/wallet/transactions";

  return getJson<WalletTransactionsResponse>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load wallet transactions.",
  });
}

export interface WalletDepositInfoResponse {
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: string;
}

export interface ProvisionVirtualAccountResponse {
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: string;
  alreadyProvisioned: boolean;
}

export async function getWalletDepositInfo(input: {
  accessToken: string;
}): Promise<WalletDepositInfoResponse> {
  return getJson<WalletDepositInfoResponse>("/wallet/deposit-info", {
    accessToken: input.accessToken,
    fallbackError: "Could not load deposit information.",
  });
}

export async function provisionVirtualAccount(input: {
  accessToken: string;
}): Promise<ProvisionVirtualAccountResponse> {
  return postJson<ProvisionVirtualAccountResponse>(
    "/wallet/provision-virtual-account",
    {},
    {
      accessToken: input.accessToken,
      fallbackError: "Could not provision virtual account.",
    },
  );
}

export async function createWalletWithdrawal(input: {
  accessToken: string;
  amountNgn: number;
  idempotencyKey?: string;
  bankAccount: {
    accountNumber: string;
    accountName: string;
    networkId: string;
  };
}): Promise<CreateWalletWithdrawalResponse> {
  return postJson<CreateWalletWithdrawalResponse>(
    "/wallet/withdrawals",
    {
      amountNgn: input.amountNgn,
      bankAccount: input.bankAccount,
    },
    {
      accessToken: input.accessToken,
      idempotencyKey: input.idempotencyKey,
      fallbackError: "Could not create wallet withdrawal.",
    },
  );
}

export async function getWithdrawalBankNetworks(input: {
  accessToken: string;
  country?: string;
  query?: string;
  limit?: number;
}): Promise<WithdrawalBankNetworksResponse> {
  const params = new URLSearchParams();
  if (input.country) {
    params.set("country", input.country);
  }
  if (input.query) {
    params.set("query", input.query);
  }
  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const path =
    params.size > 0
      ? `/wallet/withdrawals/bank-networks?${params.toString()}`
      : "/wallet/withdrawals/bank-networks";

  return getJson<WithdrawalBankNetworksResponse>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load withdrawal bank networks.",
  });
}

export async function verifyWithdrawalBankAccount(input: {
  accessToken: string;
  accountNumber: string;
  networkId: string;
  countryCode?: string;
  currency?: string;
}): Promise<VerifyWithdrawalBankAccountResponse> {
  return postJson<VerifyWithdrawalBankAccountResponse>(
    "/wallet/withdrawals/verify-bank-account",
    {
      accountNumber: input.accountNumber,
      networkId: input.networkId,
      countryCode: input.countryCode ?? "NG",
      currency: input.currency ?? "NGN",
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not verify the bank account.",
    },
  );
}

export async function getRideEstimate(input: {
  accessToken: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
}): Promise<RideEstimateResponse> {
  const cacheKey = buildRideEstimateCacheKey(input);
  const cached = rideEstimateCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < RIDE_ESTIMATE_CACHE_TTL_MS) {
    return cached.value;
  }

  const inflight = rideEstimateInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = postJson<RideEstimateResponse>(
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
  ).then((response) => {
    rideEstimateCache.set(cacheKey, {
      value: response,
      cachedAt: Date.now(),
    });
    return response;
  });

  rideEstimateInflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    rideEstimateInflight.delete(cacheKey);
  }
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
  idempotencyKey?: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
  paymentMethod?: "wallet_balance";
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
      idempotencyKey: input.idempotencyKey,
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

export async function listNotifications(input: {
  accessToken: string;
  limit?: number;
}): Promise<{ items: AppNotification[] }> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const path = params.size > 0 ? `/notifications?${params.toString()}` : "/notifications";
  return getJson<{ items: AppNotification[] }>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load notifications.",
  });
}

export async function markNotificationsRead(input: {
  accessToken: string;
  notificationIds?: string[];
}): Promise<{ updatedCount: number }> {
  return postJson<{ updatedCount: number }>(
    "/notifications/read",
    {
      notificationIds: input.notificationIds ?? [],
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not update notifications.",
    },
  );
}

export async function registerPushToken(input: {
  accessToken: string;
  expoPushToken: string;
  enabled?: boolean;
  platform?: string;
  deviceName?: string;
  appOwnership?: string;
}): Promise<{
  device: {
    id: string;
    expoPushToken: string;
    enabled: boolean;
    platform: string | null;
    deviceName: string | null;
    appOwnership: string | null;
    lastRegisteredAt: string;
  };
}> {
  return postJson("/notifications/device", input, {
    accessToken: input.accessToken,
    fallbackError: "Could not register push notifications.",
  });
}

export async function createGroupRideMatchRequest(input: {
  accessToken: string;
  idempotencyKey?: string;
  pickup: RideEstimateWaypoint;
  destination: RideEstimateWaypoint;
  stops?: RideEstimateWaypoint[];
  genderPreference?: GroupRideGenderPreference;
  paymentMethod?: "wallet_balance";
}): Promise<{
  item: GroupRideMatchRequest;
  uploadRequired: boolean;
}> {
  return postJson("/group-rides/requests", input, {
    accessToken: input.accessToken,
    idempotencyKey: input.idempotencyKey,
    fallbackError: "Could not create the group ride request.",
  });
}

export async function getGroupRideMatchRequest(input: {
  accessToken: string;
  requestId: string;
}): Promise<{ item: GroupRideMatchRequest; matchedRiders: GroupRideMatchedRider[] }> {
  return getJson(`/group-rides/requests/${encodeURIComponent(input.requestId)}`, {
    accessToken: input.accessToken,
    fallbackError: "Could not load the group ride request.",
  });
}

export async function createGroupRideFaceUploadUrl(input: {
  accessToken: string;
  requestId: string;
  mimeType: string;
  capturedAt?: string;
}): Promise<{
  upload: GroupRideFaceUploadDescriptor;
}> {
  return postJson(
    `/group-rides/requests/${encodeURIComponent(input.requestId)}/face-upload-url`,
    {
      mimeType: input.mimeType,
      capturedAt: input.capturedAt,
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not prepare the face verification upload.",
    },
  );
}

export async function completeGroupRideFaceUpload(input: {
  accessToken: string;
  requestId: string;
  capturedAt?: string;
}): Promise<{
  item: GroupRideMatchRequest;
  publishedReadyEvent: boolean;
}> {
  return postJson(
    `/group-rides/requests/${encodeURIComponent(input.requestId)}/face-upload-complete`,
    {
      capturedAt: input.capturedAt,
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not complete face verification.",
    },
  );
}

export async function cancelGroupRideMatchRequest(input: {
  accessToken: string;
  requestId: string;
  reason?: string;
}): Promise<{
  item: GroupRideMatchRequest | null;
  cancelled: boolean;
}> {
  return postJson(
    `/group-rides/requests/${encodeURIComponent(input.requestId)}/cancel`,
    {
      reason: input.reason,
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not cancel the group ride request.",
    },
  );
}

// ─── Driver API ──────────────────────────────────────────────────

export interface DriverStatsResponse {
  driverId: string;
  userId: string;
  status: string;
  kycStatus: string;
  rating: number;
  totalRides: number;
  totalEarningsNgn: number;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  vehicleYear: number | null;
  balanceNgn: number;
  lockedNgn: number;
}

export interface DriverEarningItem {
  id: string;
  amountNgn: number;
  referenceId: string;
  createdAt: string;
}

export interface DriverEarningsResponse {
  period: string;
  totalEarningsNgn: number;
  rideCount: number;
  items: DriverEarningItem[];
}

export interface DriverHistoryRide {
  id: string;
  status: string;
  pickupAddress: string;
  destAddress: string;
  fareEstimateNgn: number;
  fareFinalNgn: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  matchedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface DriverRideHistoryResponse {
  items: DriverHistoryRide[];
  nextCursor: string | null;
}

export async function getDriverStats(input: {
  accessToken: string;
}): Promise<DriverStatsResponse> {
  return getJson<DriverStatsResponse>("/drivers/me/stats", {
    accessToken: input.accessToken,
    fallbackError: "Could not load driver stats.",
  });
}

export async function getDriverEarnings(input: {
  accessToken: string;
  period?: "today" | "week" | "month";
}): Promise<DriverEarningsResponse> {
  const params = new URLSearchParams();
  if (input.period) {
    params.set("period", input.period);
  }

  const path =
    params.size > 0
      ? `/drivers/me/earnings?${params.toString()}`
      : "/drivers/me/earnings";

  return getJson<DriverEarningsResponse>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load driver earnings.",
  });
}

export async function getDriverRideHistory(input: {
  accessToken: string;
  limit?: number;
  cursor?: string;
}): Promise<DriverRideHistoryResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set("limit", String(input.limit));
  }
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  const path =
    params.size > 0
      ? `/drivers/me/rides/history?${params.toString()}`
      : "/drivers/me/rides/history";

  return getJson<DriverRideHistoryResponse>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load driver ride history.",
  });
}

// ─── Driver KYC ─────────────────────────────────────────────────

export async function submitDriverKyc(input: {
  accessToken: string;
  ninImage: string;
  licenceImage: string;
  selfieImage: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleYear: number;
}): Promise<{ status: string }> {
  return postJson<{ status: string }>(
    "/drivers/kyc/submit",
    {
      ninImage: input.ninImage,
      licenceImage: input.licenceImage,
      selfieImage: input.selfieImage,
      vehicleMake: input.vehicleMake,
      vehicleModel: input.vehicleModel,
      vehiclePlate: input.vehiclePlate,
      vehicleYear: input.vehicleYear,
    },
    {
      accessToken: input.accessToken,
      fallbackError: "Could not submit your documents.",
    },
  );
}

export interface DriverKycStatusResponse {
  kycStatus: string;
  submission: {
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    rejectedFields: string[];
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehiclePlate: string | null;
    vehicleYear: number | null;
  } | null;
}

export async function getDriverKycStatus(input: {
  accessToken: string;
}): Promise<DriverKycStatusResponse> {
  return getJson<DriverKycStatusResponse>("/drivers/kyc/status", {
    accessToken: input.accessToken,
    fallbackError: "Could not check KYC status.",
  });
}

// ── Chat ──────────────────────────────────────────────────────────

export interface ChatMessageResponse {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: "RIDER" | "DRIVER";
  content: string;
  createdAt: string;
}

export interface ChatMessagesResponse {
  items: ChatMessageResponse[];
  nextCursor: string | null;
}

export async function getRideChatMessages(input: {
  accessToken: string;
  rideId: string;
  limit?: number;
  cursor?: string;
}): Promise<ChatMessagesResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set("limit", String(input.limit));
  }
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  const path =
    params.size > 0
      ? `/rides/${input.rideId}/messages?${params.toString()}`
      : `/rides/${input.rideId}/messages`;

  return getJson<ChatMessagesResponse>(path, {
    accessToken: input.accessToken,
    fallbackError: "Could not load chat messages.",
  });
}

// ── Account management ──────────────────────────────────────────────────────

export async function logoutAccount(input: {
  accessToken: string;
}): Promise<{ success: boolean }> {
  return postJson<{ success: boolean }>("/auth/logout", {}, {
    accessToken: input.accessToken,
    fallbackError: "Could not log out.",
  });
}

export async function deleteAccount(input: {
  accessToken: string;
}): Promise<{ deleted: boolean }> {
  return postJson<{ deleted: boolean }>("/auth/delete-account", {}, {
    accessToken: input.accessToken,
    fallbackError: "Could not delete account.",
  });
}
