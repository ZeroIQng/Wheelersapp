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
