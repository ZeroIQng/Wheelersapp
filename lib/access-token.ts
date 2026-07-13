import * as SecureStore from "expo-secure-store";

export type AccessTokenGetter = () => Promise<string | null | undefined>;

const LOCAL_ACCESS_TOKEN_KEY = "wheelers.local.accessToken";
let cachedAccessToken: string | null = null;
let cachedAccessTokenAt = 0;
const ACCESS_TOKEN_CACHE_TTL_MS = 30_000;

export async function storeLocalAccessToken(accessToken: string): Promise<void> {
  cachedAccessToken = accessToken;
  cachedAccessTokenAt = Date.now();
  await SecureStore.setItemAsync(LOCAL_ACCESS_TOKEN_KEY, accessToken);
}

export async function getStoredLocalAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LOCAL_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearStoredLocalAccessToken(): Promise<void> {
  cachedAccessToken = null;
  cachedAccessTokenAt = 0;
  await SecureStore.deleteItemAsync(LOCAL_ACCESS_TOKEN_KEY);
}

export async function getAccessTokenWithRetry(
  getAccessToken: AccessTokenGetter,
  attempts = 3,
  delayMs = 150,
): Promise<string | null> {
  // Return cached token if fresh enough
  if (
    cachedAccessToken &&
    Date.now() - cachedAccessTokenAt < ACCESS_TOKEN_CACHE_TTL_MS
  ) {
    return cachedAccessToken;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      cachedAccessToken = accessToken;
      cachedAccessTokenAt = Date.now();
      return accessToken;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const localAccessToken = await getStoredLocalAccessToken();
  if (localAccessToken) {
    cachedAccessToken = localAccessToken;
    cachedAccessTokenAt = Date.now();
    return localAccessToken;
  }

  return null;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
  cachedAccessTokenAt = 0;
}
