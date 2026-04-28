const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

export type BackendRole = "RIDER" | "DRIVER" | "BOTH";

interface SyncPrivyAuthInput {
  accessToken: string;
  role: BackendRole;
  authMethod?: "email" | "google" | "apple" | "wallet";
  email?: string;
  name?: string;
  phone?: string;
  walletAddress?: string;
}

export function isBackendConfigured(): boolean {
  return Boolean(apiBaseUrl);
}

export async function syncPrivyAuth(input: SyncPrivyAuthInput): Promise<Record<string, unknown>> {
  if (!apiBaseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}/auth/privy`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Could not sync your account with Wheelers.";
    throw new Error(message);
  }

  return payload ?? {};
}
