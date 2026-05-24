import * as Crypto from "expo-crypto";

export function createIdempotencyKey(scope: string): string {
  const normalizedScope = scope.trim().replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  return `${normalizedScope}-${Crypto.randomUUID()}`;
}
