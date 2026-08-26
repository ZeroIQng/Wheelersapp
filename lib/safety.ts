import { apiRequest } from "@/lib/api";

/**
 * The emergency button.
 *
 * Everything here is built around one assumption: the person using it is
 * frightened and in a moving vehicle. So the API surface is deliberately tiny —
 * raise, check, cancel — and raising takes nothing that could fail. Location is
 * attached when the phone can supply it and omitted when it cannot, because an
 * alert with no coordinates still reaches a human, and a alert blocked on a GPS
 * fix reaches nobody.
 */

export type SafetyAlertKind =
  | "SOS"
  | "UNSAFE_DRIVING"
  | "ROUTE_DEVIATION"
  | "ACCIDENT"
  | "MEDICAL";

export type SafetyAlert = {
  id: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  kind: SafetyAlertKind;
  raisedByRole: "RIDER" | "DRIVER";
  rideId: string | null;
  interstateDepartureId: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  note: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
};

export async function raiseSafetyAlert(
  accessToken: string,
  params: {
    role: "RIDER" | "DRIVER";
    kind?: SafetyAlertKind;
    rideId?: string | null;
    interstateDepartureId?: string | null;
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    note?: string | null;
  },
) {
  return apiRequest<{ alert: SafetyAlert; alreadyOpen: boolean }>(
    "POST",
    "/safety/alerts",
    {
      accessToken,
      body: params,
      fallbackError:
        "We could not send your alert. If you are in danger, call 112 now.",
    },
  );
}

export async function getActiveSafetyAlert(
  accessToken: string,
  rideId?: string | null,
) {
  const query = rideId ? `?rideId=${encodeURIComponent(rideId)}` : "";
  return apiRequest<{ alert: SafetyAlert | null }>(
    "GET",
    `/safety/alerts/active${query}`,
    {
      accessToken,
      fallbackError: "We could not check your alert status.",
    },
  );
}

export async function cancelSafetyAlert(
  accessToken: string,
  alertId: string,
  reason?: string,
) {
  return apiRequest<{ alert: SafetyAlert }>(
    "POST",
    `/safety/alerts/${encodeURIComponent(alertId)}/cancel`,
    {
      accessToken,
      body: { reason },
      fallbackError: "We could not cancel your alert.",
    },
  );
}

/** The number a Nigerian rider should actually dial. */
export const EMERGENCY_PHONE_NUMBER = "112";

export function describeAlertKind(kind: SafetyAlertKind): string {
  switch (kind) {
    case "SOS":
      return "I need help now";
    case "UNSAFE_DRIVING":
      return "Unsafe driving";
    case "ROUTE_DEVIATION":
      return "We are off the route";
    case "ACCIDENT":
      return "There has been an accident";
    case "MEDICAL":
      return "Medical emergency";
    default:
      return kind;
  }
}
