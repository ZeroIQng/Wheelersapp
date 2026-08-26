/**
 * Turning failures into sentences a passenger can act on.
 *
 * Most of what reaches a catch block in this app was written for whoever is
 * reading the logs: `EXPO_PUBLIC_API_BASE_URL is not configured`, `Network
 * request failed`, `Invalid pickup payload`, a Prisma stack trace. Putting any
 * of those in front of someone standing at a bus park with a phone tells them
 * nothing they can do about it.
 *
 * So this module answers one question for every error: **what should this
 * person do now?** Two rules keep it honest:
 *
 *  1. A message the backend deliberately wrote for a user is passed through
 *     untouched. The API already says things like "You need a Wheelers wallet
 *     before booking" — rewriting that would be a downgrade.
 *  2. Anything that looks like it was written for a developer is replaced, and
 *     the original is preserved in `technical` so it still reaches the logs.
 *
 * In development the technical detail is appended to the visible message, so
 * this never becomes a wall between an engineer and the real cause.
 */

/** Fragments that mark a string as written for a developer, not a traveller. */
const DEVELOPER_SHAPED = [
  "expo_public_",
  "process.env",
  "undefined is not",
  "null is not an object",
  "cannot read property",
  "cannot read properties",
  "unexpected token",
  "json parse",
  "invalid json",
  "prisma",
  "econnrefused",
  "enotfound",
  "etimedout",
  "socket hang up",
  "websocket",
  "stack trace",
  "at object.",
  "typeerror",
  "referenceerror",
  "syntaxerror",
  "500 internal",
  "invalid payload",
  "missing required field",
  "must be a json object",
  "is not configured",
  "lan ip",
  "127.0.0.1",
  "localhost",
];

const CONNECTIVITY_MESSAGE =
  "You appear to be offline. Check your data connection and try again.";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Does this error carry an HTTP status?
 *
 * Deliberately structural rather than `instanceof ApiError`: this module is
 * imported by everything, and reaching into `lib/api` for a class would drag
 * the whole networking layer — and React Native itself — behind it. A shape
 * check also keeps working across module boundaries, where `instanceof` is
 * quietly unreliable.
 */
function httpStatusOf(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

/**
 * Bare HTTP status phrases.
 *
 * A backend that 404s with `{"error":"Not found"}` is not writing to a rider —
 * it is restating the status line. These reached the screen verbatim, so a
 * rider opening Travel before the routes were deployed simply saw "Not found"
 * with no idea what was not found or what to do about it.
 */
const HTTP_STATUS_PHRASES = new Set([
  "not found",
  "bad request",
  "unauthorized",
  "forbidden",
  "conflict",
  "internal server error",
  "service unavailable",
  "bad gateway",
  "gateway timeout",
  "too many requests",
  "unprocessable entity",
  "method not allowed",
  "request failed",
  "error",
]);

function looksLikeDeveloperMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim().replace(/[.!]+$/, "");
  return (
    normalized.length === 0 ||
    normalized.length > 220 ||
    HTTP_STATUS_PHRASES.has(normalized) ||
    DEVELOPER_SHAPED.some((fragment) => normalized.includes(fragment))
  );
}

function isConnectivityFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network request failed") ||
    normalized.includes("could not reach") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("offline")
  );
}

/**
 * What to say for an HTTP status when the body gave us nothing usable.
 * Deliberately phrased as the next action, not as the failure.
 */
function messageForStatus(status: number, fallback: string): string {
  if (status === 401 || status === 403) {
    return "Please sign in again to continue.";
  }
  if (status === 404) {
    return "We could not find that. It may have been cancelled or completed already.";
  }
  if (status === 409) {
    return "That has already changed. Pull to refresh and try again.";
  }
  if (status === 413) {
    return "That file is too large. Try a smaller one.";
  }
  if (status === 429) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (status >= 500) {
    return "Our servers are having a moment. Please try again shortly.";
  }
  return fallback;
}

export type UserFacingError = {
  /** Safe to put in front of a rider or driver. */
  message: string;
  /** The original text, for logs and for the dev build. */
  technical: string;
  /** True when retrying the same action is a sensible next step. */
  retryable: boolean;
};

export function describeError(
  error: unknown,
  fallback: string = GENERIC_MESSAGE,
): UserFacingError {
  const technical = rawMessage(error);

  if (isConnectivityFailure(technical)) {
    return { message: CONNECTIVITY_MESSAGE, technical, retryable: true };
  }

  const status = httpStatusOf(error);
  if (status !== null) {
    // The backend's own wording wins whenever it was written for a person.
    const message = looksLikeDeveloperMessage(technical)
      ? messageForStatus(status, fallback)
      : technical;

    return {
      message,
      technical,
      retryable: status >= 500 || status === 429,
    };
  }

  if (looksLikeDeveloperMessage(technical)) {
    return { message: fallback, technical, retryable: true };
  }

  return { message: technical, technical, retryable: true };
}

/**
 * The one-liner most call sites want: give me something I can show.
 *
 * In development the technical cause is appended, because a developer staring
 * at "Something went wrong" learns nothing either.
 */
export function toUserMessage(error: unknown, fallback?: string): string {
  const described = describeError(error, fallback);

  if (__DEV__ && described.technical && described.technical !== described.message) {
    return `${described.message}\n\n[dev] ${described.technical}`;
  }

  return described.message;
}
