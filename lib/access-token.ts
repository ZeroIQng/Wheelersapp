export type AccessTokenGetter = () => Promise<string | null | undefined>;

let cachedAccessToken: string | null = null;
let cachedAccessTokenAt = 0;
const ACCESS_TOKEN_CACHE_TTL_MS = 30_000;

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

  return null;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
  cachedAccessTokenAt = 0;
}
