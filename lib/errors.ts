function getMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  return typeof value === "string" ? value : "";
}

export function isIgnorableUserCancelledError(value: unknown): boolean {
  const message = getMessage(value).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("user cancelled") ||
    message.includes("user canceled") ||
    message.includes("operation cancelled") ||
    message.includes("operation canceled") ||
    message.includes("request cancelled") ||
    message.includes("request canceled")
  );
}

export function getDisplayErrorMessage(
  value: unknown,
  fallback: string,
): string | null {
  if (isIgnorableUserCancelledError(value) && !__DEV__) {
    return null;
  }

  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message;
  }

  return fallback;
}
