function appendPart(parts: string[], value: unknown): void {
  if (typeof value !== "string") {
    return;
  }

  const next = value.trim();
  if (!next) {
    return;
  }

  if (!parts.some((part) => part.toLowerCase() === next.toLowerCase())) {
    parts.push(next);
  }
}

function getMessage(value: unknown): string {
  if (!value) {
    return "";
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const parts: string[] = [];

  appendPart(parts, record.message);
  appendPart(parts, record.error);
  appendPart(parts, record.details);
  appendPart(parts, record.description);
  appendPart(parts, record.reason);
  appendPart(parts, record.code);
  appendPart(parts, record.name);

  if (record.cause && typeof record.cause !== "boolean" && record.cause !== value) {
    appendPart(parts, getMessage(record.cause));
  }

  return parts.join(" ");
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
    message.includes("request canceled") ||
    message.includes("redirect cancelled") ||
    message.includes("redirect canceled") ||
    message.includes("dismissed") ||
    message.includes("aborted") ||
    message.includes("closed by user")
  );
}

export function getDisplayErrorMessage(
  value: unknown,
  fallback: string,
): string | null {
  if (isIgnorableUserCancelledError(value) && !__DEV__) {
    return null;
  }

  const message = getMessage(value);
  const normalized = message.toLowerCase();

  if (message.trim().length > 0) {
    return message;
  }

  return fallback;
}
