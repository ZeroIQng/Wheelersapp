export type AccessTokenGetter = () => Promise<string | null | undefined>;

export async function getAccessTokenWithRetry(
  getAccessToken: AccessTokenGetter,
  attempts = 6,
  delayMs = 250,
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      return accessToken;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}
